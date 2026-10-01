#include <stdio.h>

int main(void) {
    FILE *out = fopen("report.txt", "w");
    if (out == NULL) {
        perror("report.txt");
        return 1;
    }
    fprintf(out, "404 report\n");
    fprintf(out, "count: %d\n", 5);
    fclose(out);
    return 0;
}
