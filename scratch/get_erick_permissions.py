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

    print("=== PERMISOS DE ERICK EN BASE DE DATOS ===")
    sql = 'SELECT u.name, u.cedula, r.name as role_name, p.action FROM \\"User\\" u JOIN \\"Role\\" r ON u.\\"roleId\\" = r.id JOIN \\"_PermissionToRole\\" pr ON r.id = pr.\\"B\\" JOIN \\"Permission\\" p ON pr.\\"A\\" = p.id WHERE u.cedula = \'1726664749\' ORDER BY p.action;'
    cmd = f'docker exec mba3-bi-db psql -U postgres -d MBAPruebas -c "{sql}"'
    stdin, stdout, stderr = client.exec_command(cmd)
    print(stdout.read().decode('utf-8', errors='replace'))
    print(stderr.read().decode('utf-8', errors='replace'))

    client.close()

if __name__ == "__main__":
    main()
