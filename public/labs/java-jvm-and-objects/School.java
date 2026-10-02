import java.util.ArrayList;

public class School {
    public static void main(String[] args) {
        Student a = new Student("alice", 58);
        Student b = new Student("bob", 92);
        System.out.println(a + " " + b);

        a.addBonus(5);
        System.out.println(a + " passed: " + a.passed());

        Student c = a;
        c.addBonus(10);
        System.out.println(a + " " + (a == c));

        ArrayList<Student> list = new ArrayList<>();
        list.add(a);
        list.add(b);
        list.add(new Student("carol", 45));
        for (Student s : list) {
            System.out.println(s.getName() + " -> " + (s.passed() ? "pass" : "fail"));
        }
        System.out.println(list.size() + " students");
    }
}
