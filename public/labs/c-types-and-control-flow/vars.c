#include <stdio.h>

int main(void) {
    char grade = 'A';
    int count = 3;
    long big = 5000000000;
    count = count + 1;
    grade = grade + 2;
    printf("%c %d %ld\n", grade, count, big);
    return 0;
}
