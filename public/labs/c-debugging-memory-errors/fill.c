#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *squares = malloc(4 * sizeof(int));
    for (int i = 0; i <= 4; i++) {
        squares[i] = i * i;
    }
    printf("%d\n", squares[3]);
    free(squares);
    return 0;
}
