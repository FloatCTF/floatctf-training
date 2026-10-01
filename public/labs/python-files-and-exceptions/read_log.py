with open("access.log") as f:
    lines = f.readlines()

print(len(lines))
print(lines[0])
print(lines[0].strip())
