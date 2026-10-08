line = '198.51.100.7 - - [01/Oct/2026:09:12:21 +0800] "GET /backup.zip HTTP/1.1" 404 162'
parts = line.split()
print(parts[0])
print(parts[6])
print(parts[8])
print(int(parts[8]) == 404)
print(line.startswith("198."))
