#include <stdio.h>
#include <limits.h>

int main(void) {
    unsigned char small = 255;
    small = small + 1;
    printf("%d\n", small);

    unsigned char cut = 300;
    printf("%d\n", cut);

    unsigned int big = UINT_MAX;
    printf("%u\n", big);
    big = big + 1;
    printf("%u\n", big);

    printf("%d\n", INT_MAX);
    return 0;
}
