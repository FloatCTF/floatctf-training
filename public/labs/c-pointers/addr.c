#include <stdio.h>

int main(void) {
    int x = 3;
    int *p = &x;
    printf("%d\n", x);
    printf("%p\n", (void *)&x);
    printf("%p\n", (void *)p);
    printf("%d\n", *p);
    *p = 99;
    printf("%d\n", x);
    return 0;
}
