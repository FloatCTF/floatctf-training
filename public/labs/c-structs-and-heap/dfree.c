#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *score = malloc(sizeof(int));
    *score = 90;
    free(score);
    free(score);
    printf("done\n");
    return 0;
}
