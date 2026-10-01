ips = ["192.0.2.10", "198.51.100.7", "192.0.2.10", "203.0.113.5", "192.0.2.10"]
counts = {}
for ip in ips:
    counts[ip] = counts.get(ip, 0) + 1
print(counts)
for ip, n in counts.items():
    print(n, ip)
top = sorted(counts, key=counts.get, reverse=True)
print("top:", top[0])
