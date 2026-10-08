#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *score = malloc(sizeof(int));
    *score = 90;
    free(score);
    printf("%d\n", *score);
    return 0;
}
