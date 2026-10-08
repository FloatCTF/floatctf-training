#include <stdio.h>
#include "stats.h"

int main(void) {
    int sizes[5] = {512, 2048, 128, 4096, 1024};
    printf("total   %d\n", total(sizes, 5));
    printf("largest %d\n", largest(sizes, 5));
    return 0;
}
