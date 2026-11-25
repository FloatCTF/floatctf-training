#include <stdio.h>
#include <stdlib.h>

static int global_counter = 42;

int main(void) {
    int stack_var = 7;
    int *heap_var = malloc(sizeof(int));
    if (!heap_var) {
        return 1;
    }
    *heap_var = 99;

    const char *mode = getenv("APP_MODE");
    printf("APP_MODE = %s\n", mode ? mode : "(unset)");
    printf("code   (main)   = %p\n", (void *)main);
    printf("data   (global) = %p\n", (void *)&global_counter);
    printf("heap   (malloc) = %p\n", (void *)heap_var);
    printf("stack  (local)  = %p\n", (void *)&stack_var);

    FILE *fp = fopen("/etc/hostname", "r");
    if (fp) {
        char buf[64] = {0};
        if (fgets(buf, sizeof(buf), fp)) {
            printf("hostname_file   = %s", buf);
        }
        fclose(fp);
    }

    free(heap_var);
    return 0;
}
