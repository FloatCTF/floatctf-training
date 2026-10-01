def is_strong(password, min_length=8):
    return len(password) >= min_length

if __name__ == "__main__":
    print(is_strong("kali123"))
    print(is_strong("kali123", 6))
    print(is_strong("kali-2026-ok"))
