counts = {}
with open("access.log") as f:
    for line in f:
        ip = line.split()[0]
        counts[ip] = counts.get(ip, 0) + 1

for ip in sorted(counts, key=counts.get, reverse=True):
    print(counts[ip], ip)
