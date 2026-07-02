import requests
import json

BASE_URL = "http://181.198.104.181:8020"
URL_LOGIN = f"{BASE_URL}/ws2_mba3_serv_/login_servicio"
URL_CONSULTA = f"{BASE_URL}/ws2_mba3_serv_Consultas_Externas_/"

payload_login = {"codigo": "SERIALES", "pwd": "Admin2026@@"}
res_login = requests.post(URL_LOGIN, json=payload_login)
token = res_login.json().get("jwt")
headers = {"Authorization": token}

# Test string range query with MF_Bool5 filter
payload_range = {
    "select": "ID_Relacionado,MF_Nume1,MF_Alfa2,MF_Lista2,MF_Bool5",
    "from": "CONT_Info_Fiscal",
    "where": "ID_Relacionado >= 'I-' AND ID_Relacionado < 'J-' AND MF_Bool5 = 0",
    "limit": "10"
}
res_range = requests.post(URL_CONSULTA, headers=headers, data=payload_range)
print("Range Query status:", res_range.status_code)
print(json.dumps(res_range.json(), indent=2))
