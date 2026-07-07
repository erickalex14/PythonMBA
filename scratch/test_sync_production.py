import paramiko

def main():
    hostname = "181.198.104.181"
    port = 27619
    username = "novitecadmin"
    password = "novi123"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname, port=port, username=username, password=password, timeout=15)

    print("=== GATILLANDO SINCRONIZACIÓN MANUAL DE PRUEBA (PROD - 2026-06-19) ===")
    
    python_cmd = """
import requests

# URL interna de FastAPI
url = "http://127.0.0.1:8000/api/v1/sync/movimientos?inicio=2026-06-19&fin=2026-06-19&env=PROD"
headers = {
    "x-api-key": "mba3-bi-internal-secret-key-2026",
    "Content-Type": "application/json"
}

try:
    print("Enviando POST a:", url)
    res = requests.post(url, headers=headers, timeout=180)
    print("Status:", res.status_code)
    print("Respuesta:", res.json())
except Exception as e:
    print("Error:", e)
"""
    # Guardar script temporal
    client.exec_command("echo '" + python_cmd.replace("'", "'\\''") + "' > /tmp/test_sync_production.py")
    client.exec_command("docker cp /tmp/test_sync_production.py mba3-bi-backend:/tmp/test_sync_production.py")
    
    stdin, stdout, stderr = client.exec_command("docker exec mba3-bi-backend python /tmp/test_sync_production.py")
    print("=== STDOUT ===")
    print(stdout.read().decode('utf-8', errors='ignore'))
    print("=== STDERR ===")
    print(stderr.read().decode('utf-8', errors='ignore'))

    client.close()

if __name__ == "__main__":
    main()
