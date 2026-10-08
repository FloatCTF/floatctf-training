text = "abc"
try:
    number = int(text)
    print("number:", number)
except ValueError:
    print("not a number:", text)
print("done")
