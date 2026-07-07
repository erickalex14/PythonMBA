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

    # 1. Logs del backend
    print("=== LOGS DEL BACKEND (ÚLTIMAS 15 LÍNEAS) ===")
    stdin, stdout, stderr = client.exec_command("docker logs mba3-bi-backend --tail 15")
    print(stdout.read().decode('utf-8', errors='replace'))
    print(stderr.read().decode('utf-8', errors='replace'))

    # 2. Verificar que el backend responde
    print("\n=== TEST HEALTH DEL BACKEND ===")
    stdin, stdout, stderr = client.exec_command("docker exec mba3-bi-frontend wget -qO- http://backend:8000/docs 2>&1 | head -5")
    print(stdout.read().decode('utf-8', errors='replace'))

    # 3. Verificar .env cargado en el backend
    print("\n=== .ENV DEL BACKEND ===")
    stdin, stdout, stderr = client.exec_command("docker exec mba3-bi-backend cat /app/.env")
    print(stdout.read().decode('utf-8', errors='replace'))

    client.close()

if __name__ == "__main__":
    main()
