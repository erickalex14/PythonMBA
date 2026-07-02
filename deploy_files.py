import paramiko
import os
import sys
import subprocess

def get_git_files(base_local):
    git_path = r"C:\Program Files\Git\bin\git.exe"
    try:
        res = subprocess.run([git_path, "diff", "origin/main", "--name-only"], 
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
            if f.endswith('.bak'):
                continue
            filtered.append(f)
        return filtered
    except Exception as e:
        print(f"Error running git diff: {e}")
        return []

def sftp_mkdir_p(sftp, remote_directory):
    """
    Recursively creates a directory on the remote server if it doesn't exist.
    """
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

def deploy():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # Python versions < 3.7 do not have reconfigure
        pass

    hostname = "181.198.104.181"
    port = 27619
    username = "novitecadmin"
    password = "novi123"

    base_local = r"c:\Users\dc4\Desktop\WEB + SGN\novitec-sgn"
    base_remote = "/home/novitecadmin/novitec-stack/novitec-sgn"

    files_to_deploy_rel = get_git_files(base_local)
    if not files_to_deploy_rel:
        print("No files found to deploy.")
        return

    print(f"Found {len(files_to_deploy_rel)} files to deploy:")
    for f in files_to_deploy_rel:
        print(f" - {f}")

    try:
        # 1. Establish SSH connection
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        print(f"\nConnecting to {hostname}:{port} as {username}...")
        client.connect(hostname, port=port, username=username, password=password, timeout=15)
        print("SSH Connected successfully!\n")

        # 2. Establish SFTP connection
        sftp = client.open_sftp()
        print("SFTP Client opened.")

        for rel_path in files_to_deploy_rel:
            remote_rel = rel_path.replace('\\', '/')
            local_file = os.path.join(base_local, rel_path)
            remote_file = f"{base_remote}/{remote_rel}"
            
            # Ensure parent remote directory exists
            remote_dir = os.path.dirname(remote_file)
            sftp_mkdir_p(sftp, remote_dir)
            
            print(f"Uploading:\n  Local:  {local_file}\n  Remote: {remote_file}")
            sftp.put(local_file, remote_file)
            print("Upload completed.")
            print("-" * 40)
        
        sftp.close()

        # 3. Run remote commands to update, migrate, and clear cache
        commands = [
            "echo '=== Rebuilding novitec-sgn docker image ==='",
            "cd /home/novitecadmin/novitec-stack && docker compose -f docker-compose.prod.yml up -d --build novitec-sgn",
            "echo '=== Running Migrations ==='",
            "docker exec novitec-sgn php artisan migrate --force || echo 'Migrations failed or not needed'",
            "echo '=== Clearing Laravel Cache ==='",
            "docker exec novitec-sgn php artisan optimize:clear || echo 'Cache clear failed'"
        ]

        for cmd in commands:
            print(f"Executing remote command: {cmd}")
            stdin, stdout, stderr = client.exec_command(cmd)
            # Wait for command completion
            channel = stdout.channel
            while not channel.exit_status_ready():
                if channel.recv_ready():
                    print(channel.recv(1024).decode('utf-8', errors='ignore'), end='')
            print(stdout.read().decode('utf-8', errors='ignore'))
            err = stderr.read().decode('utf-8', errors='ignore').strip()
            if err:
                print(f"Stderr: {err}")
            print("-" * 40)

        client.close()
        print("Deployment completed successfully!")

    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    deploy()
