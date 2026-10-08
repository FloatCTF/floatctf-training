#include <stdio.h>

int main(void) {
    char *s = "kali";
    int count = 0;
    while (*s != '\0') {
        printf("%c ", *s);
        s++;
        count++;
    }
    printf("\n%d\n", count);
    return 0;
}
