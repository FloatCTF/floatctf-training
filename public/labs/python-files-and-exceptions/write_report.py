with open("report.txt", "w") as f:
    f.write("404 report\n")
    f.write("count: 5\n")

with open("report.txt", "a") as f:
    f.write("checked by kali\n")
