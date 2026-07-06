import paramiko
import os
import sys
import subprocess

def get_git_tracked_files(base_local):
    git_path = r"C:\Program Files\Git\bin\git.exe"
    try:
        res = subprocess.run([git_path, "ls-files"], 
                             cwd=base_local, 
                             capture_output=True, 
                             text=True, 
                             check=True)
        files = res.stdout.strip().split('\n')
        filtered = []
        for f in files:
            f = f.strip()
            if not f:
                continue
            filtered.append(f)
        return filtered
    except Exception as e:
        print(f"Error running git ls-files: {e}")
        return []

def sftp_mkdir_p(sftp, remote_directory):
    path_parts = remote_directory.split('/')
    current_path = ""
    for part in path_parts:
        if not part:
            continue
        current_path += "/" + part
        try:
            sftp.stat(current_path)
        except IOError:
            print(f"Creating remote directory: {current_path}")
            sftp.mkdir(current_path)

def run_ssh_command_sudo(client, cmd, password):
    print(f"Executing: {cmd}")
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}")
    stdin.write(f"{password}\n")
    stdin.flush()
    
    # Esperar a que el comando termine
    channel = stdout.channel
    while not channel.exit_status_ready():
        if channel.recv_ready():
            chunk = channel.recv(1024).decode('utf-8', errors='ignore')
            # Imprimir de forma segura evitando fallos de codificación CP1252 en Windows
            sys.stdout.write(chunk.encode('ascii', 'ignore').decode('ascii'))
            sys.stdout.flush()
            
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    
    # Limpiar contraseña de la salida
    err = err.replace(f"[sudo] password for novitecadmin: ", "")
    
    out_safe = out.encode('ascii', 'ignore').decode('ascii')
    err_safe = err.encode('ascii', 'ignore').decode('ascii')
    
    if out_safe.strip():
        print(out_safe)
    if err_safe.strip():
        print(f"Stderr: {err_safe}")
    print("-" * 50)

def main():
    hostname = "181.198.104.181"
    port = 27619
    username = "novitecadmin"
    password = "novi123"

    base_local = r"c:\Users\dc4\Desktop\Python MBA"
    base_remote = "/home/novitecadmin/novitec-stack/mba3-bi"

    # 1. Obtener lista de archivos en Git
    files_to_deploy = get_git_tracked_files(base_local)
    if not files_to_deploy:
        print("No files found to deploy.")
        return

    print(f"Found {len(files_to_deploy)} files to deploy.")

    try:
        # 2. Conectar SSH
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        print(f"\nConnecting to {hostname}:{port}...")
        client.connect(hostname, port=port, username=username, password=password, timeout=15)
        print("SSH Connected successfully!\n")

        # 3. Conectar SFTP
        sftp = client.open_sftp()
        print("SFTP Client opened.")

        # Asegurar directorio base remoto
        sftp_mkdir_p(sftp, base_remote)

        # Subir archivos
        for rel_path in files_to_deploy:
            remote_rel = rel_path.replace('\\', '/')
            local_file = os.path.join(base_local, rel_path)
            remote_file = f"{base_remote}/{remote_rel}"
            
            # Asegurar carpeta contenedora
            remote_dir = os.path.dirname(remote_file)
            sftp_mkdir_p(sftp, remote_dir)
            
            sftp.put(local_file, remote_file)
        
        print("All repository files uploaded via SFTP.")

        # 4. Crear archivos .env en el servidor en la carpeta deploy/env
        sftp_mkdir_p(sftp, f"{base_remote}/deploy/env")
        
        local_backend_env = os.path.join(base_local, "Backend", ".env")
        remote_backend_env = f"{base_remote}/deploy/env/backend.env"
        print(f"Uploading backend secrets to: {remote_backend_env}")
        sftp.put(local_backend_env, remote_backend_env)

        local_frontend_env = os.path.join(base_local, "frontend", ".env")
        remote_frontend_env = f"{base_remote}/deploy/env/frontend.env"
        print(f"Uploading frontend secrets to: {remote_frontend_env}")
        sftp.put(local_frontend_env, remote_frontend_env)

        sftp.close()
        print("SFTP finished.")

        # 5. Detener y reconstruir el stack Docker Compose en producción
        print("\n=== Rebuilding MBA3 BI Docker Container Stack ===")
        docker_commands = [
            f"sh -c 'cd {base_remote} && docker compose down'",
            f"sh -c 'cd {base_remote} && docker compose build --no-cache'",
            f"sh -c 'cd {base_remote} && docker compose up -d'"
        ]
        for cmd in docker_commands:
            run_ssh_command_sudo(client, cmd, password)

        # 6. Actualizar aaPanel Nginx Config para novitec.com.ec
        print("\n=== Checking Nginx configuration ===")
        nginx_conf_path = "/www/server/panel/vhost/nginx/novitec.com.ec.conf"
        
        # Leer el archivo actual
        stdin, stdout, stderr = client.exec_command(f"sudo -S cat {nginx_conf_path}")
        stdin.write(f"{password}\n")
        stdin.flush()
        nginx_content = stdout.read().decode('utf-8', errors='ignore')
        
        # Forzar reconfiguración para limpiar bloques redundantes
        print("Configuring clean Nginx proxy locations for MBA3 BI...")
        
        # Limpiar bloques anteriores para evitar duplicidades
        markers = [
            "# Redirecciones de barra inclinada",
            "# Rewrite: /api/auth",
            "# Rewrite: /api/",
            "# Rewrite: /api/*",
            "location /api {",
            "# Proxy para Backend MBA3 BI"
        ]
        first_idx = -1
        for mark in markers:
            idx = nginx_content.find(mark)
            if idx != -1:
                if first_idx == -1 or idx < first_idx:
                    first_idx = idx
            
        if first_idx != -1:
            print(f"Removing previous MBA3 BI Nginx configuration blocks starting at index {first_idx}...")
            nginx_content = nginx_content[:first_idx] + "}\n"
            
        # Definir las nuevas ubicaciones de prefijo limpias (Nginx prefix matching)
        new_locations = """
    # Rewrite: /api/* → /reportesmba/api/* (NextAuth + API routes fix)
    # next-auth/react y los componentes del dashboard hacen peticiones a /api/
    # sin el basePath /reportesmba de Next.js. Esta regla reescribe TODAS las
    # rutas /api/* para que Nginx las enrute al frontend correctamente.
    location /api {
        rewrite ^/api(.*)$ /reportesmba/api$1 last;
    }

    # Proxy para Backend MBA3 BI (FastAPI)
    location /apimbav1 {
        rewrite ^/apimbav1/?(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:8002;
        proxy_http_version 1.1;
        proxy_read_timeout 300;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }

    # Proxy para Frontend MBA3 BI (Next.js)
    location /reportesmba {
        proxy_pass http://127.0.0.1:8003;
        proxy_http_version 1.1;
        proxy_read_timeout 300;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
"""
        # Insertamos las ubicaciones antes del cierre del bloque de servidor SSL (el último '}')
        last_brace_idx = nginx_content.rfind("}")
        if last_brace_idx != -1:
            modified_nginx = nginx_content[:last_brace_idx] + new_locations + nginx_content[last_brace_idx:]
            
            # Escribir el nuevo archivo temporalmente
            temp_nginx_path = "/tmp/novitec_temp.conf"
            sftp = client.open_sftp()
            with sftp.file(temp_nginx_path, "w") as f:
                f.write(modified_nginx)
            sftp.close()
            
            # Reemplazar la configuración real con sudo
            run_ssh_command_sudo(client, f"cp {temp_nginx_path} {nginx_conf_path}", password)
            run_ssh_command_sudo(client, f"rm {temp_nginx_path}", password)
            print("Nginx config file updated successfully.")
        else:
            print("Error: Could not find closing brace in nginx configuration.")

        # 7. Validar y reiniciar Nginx
        print("\n=== Validating and reloading Nginx ===")
        run_ssh_command_sudo(client, "/www/server/nginx/sbin/nginx -t", password)
        run_ssh_command_sudo(client, "/www/server/nginx/sbin/nginx -s reload", password)

        # 8. Mostrar estado de los contenedores
        print("\n=== Final docker containers status ===")
        run_ssh_command_sudo(client, "docker ps", password)

        client.close()
        print("Deployment finished successfully!")

    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
