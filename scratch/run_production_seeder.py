import paramiko

def main():
    hostname = "181.198.104.181"
    port = 27619
    username = "novitecadmin"
    password = "novi123"

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname, port=port, username=username, password=password, timeout=15)

    print("=== EJECUTANDO PRISMA SEEDER DENTRO DEL CONTENEDOR EN PRODUCCIÓN ===")
    
    stdin, stdout, stderr = client.exec_command("docker exec mba3-bi-frontend npx tsx prisma/seed.ts")
    print("=== STDOUT ===")
    print(stdout.read().decode('utf-8', errors='ignore'))
    print("=== STDERR ===")
    print(stderr.read().decode('utf-8', errors='ignore'))

    client.close()

if __name__ == "__main__":
    main()
