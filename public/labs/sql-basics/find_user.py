import sqlite3

con = sqlite3.connect("shop.db")
name = input("name: ")
row = con.execute("SELECT name, role FROM users WHERE name = ?", (name,)).fetchone()
if row is None:
    print("no such user")
else:
    print(row[0], "is", row[1])
con.close()
