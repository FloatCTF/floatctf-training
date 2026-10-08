import requests

URL = "http://127.0.0.1:8000/api/items"

page = 1
count = 0
total = 0
while True:
    r = requests.get(URL, params={"page": page}, timeout=5)
    items = r.json()["items"]
    if not items:
        break
    for item in items:
        count += 1
        total += item["price"]
    print("page", page, "->", len(items), "items")
    page += 1

print("items:", count)
print("total price:", total)
