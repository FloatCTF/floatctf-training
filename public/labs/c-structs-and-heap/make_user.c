#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct user {
    char name[8];
    int level;
};

struct user *new_user(const char *name) {
    struct user *u = malloc(sizeof(struct user));
    strcpy(u->name, name);
    u->level = 1;
    return u;
}

int main(void) {
    struct user *bob = new_user("bob");
    printf("%s %d\n", bob->name, bob->level);
    free(bob);
    return 0;
}
