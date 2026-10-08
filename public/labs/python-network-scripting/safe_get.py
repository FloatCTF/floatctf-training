import requests

URL = "http://127.0.0.1:8000/hello"

try:
    r = requests.get(URL, params={"name": "kali"}, timeout=5)
    r.raise_for_status()
    print(r.text.strip())
except requests.exceptions.ConnectionError:
    print("cannot connect: is the practice site running?")
except requests.exceptions.HTTPError as error:
    print("the server said no:", error)
