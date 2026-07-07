import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    hostname = "181.198.104.181"
    port = 27619
    username = "novitecadmin"
    password = "novi123"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname, port=port, username=username, password=password, timeout=15)

    print("=== CONFIGURACIÓN DE NGINX DE NOVITEC ===")
    nginx_conf_path = "/www/server/panel/vhost/nginx/novitec.com.ec.conf"
    stdin, stdout, stderr = client.exec_command(f"sudo -S cat {nginx_conf_path}")
    stdin.write(f"{password}\n")
    stdin.flush()
    print(stdout.read().decode('utf-8', errors='replace'))

    client.close()

if __name__ == "__main__":
    main()
