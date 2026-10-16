import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, setLogLevel } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

// Suppress noisy Firestore logs
setLogLevel("error");

beforeAll(async () => {
  const rulesPath = path.resolve(__dirname, "../firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: "test-project-" + Date.now(),
    firestore: { rules, host: "127.0.0.1", port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// Helper: seed data using admin context (bypasses rules)
async function seedDoc(collectionPath: string, docId: string, data: Record<string, any>) {
  const admin = testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), collectionPath, docId), data);
  });
  return admin;
}

// ──────────────────── PROFILES ────────────────────

describe("profiles", () => {
  const studentUid = "student1";
  const otherUid = "other1";
  const adminUid = "admin1";
  const instructorUid = "instructor1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active", full_name: "Admin" });
    await seedDoc("profiles", instructorUid, { role: "instructor", status: "active", full_name: "Instructor" });
    await seedDoc("profiles", studentUid, { role: "student", status: "active", full_name: "Student", wallet_balance: 100 });
  });

  it("owner can read own profile", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(getDoc(doc(db, "profiles", studentUid)));
  });

  it("unauthenticated cannot read profiles", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "profiles", studentUid)));
  });

  it("other student cannot read another profile", async () => {
    const db = testEnv.authenticatedContext(otherUid).firestore();
    await assertFails(getDoc(doc(db, "profiles", studentUid)));
  });

  it("instructor can read student profile", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(getDoc(doc(db, "profiles", studentUid)));
  });

  it("admin can read any profile", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(getDoc(doc(db, "profiles", studentUid)));
  });

  it("client cannot create profile (allow create: if false)", async () => {
    const db = testEnv.authenticatedContext("newuser").firestore();
    await assertFails(setDoc(doc(db, "profiles", "newuser"), { full_name: "New User" }));
  });

  it("owner can update allowlisted fields", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(updateDoc(doc(db, "profiles", studentUid), { full_name: "New Name", phone: "123" }));
  });

  it("owner cannot update role", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(updateDoc(doc(db, "profiles", studentUid), { role: "admin" }));
  });

  it("owner cannot update status", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(updateDoc(doc(db, "profiles", studentUid), { status: "active" }));
  });

  it("owner cannot update wallet_balance", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(updateDoc(doc(db, "profiles", studentUid), { wallet_balance: 9999 }));
  });

  it("owner cannot update active_devices", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(updateDoc(doc(db, "profiles", studentUid), { active_devices: [] }));
  });

  it("admin can update any field", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(updateDoc(doc(db, "profiles", studentUid), { role: "instructor", status: "blocked" }));
  });

  it("admin can delete profile", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(deleteDoc(doc(db, "profiles", studentUid)));
  });

  it("non-admin cannot delete profile", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(deleteDoc(doc(db, "profiles", studentUid)));
  });
});

// ──────────────────── ENROLLMENTS ────────────────────

describe("enrollments", () => {
  const studentUid = "student1";
  const instructorUid = "instructor1";
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("profiles", instructorUid, { role: "instructor", status: "active" });
    await seedDoc("profiles", studentUid, { role: "student", status: "active" });
    await seedDoc("enrollments", "enr1", {
      student_id: studentUid,
      instructor_id: instructorUid,
      course_id: "course1",
      progress: 0,
      completed_lessons: [],
    });
  });

  it("enrolled student can read own enrollment", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(getDoc(doc(db, "enrollments", "enr1")));
  });

  it("instructor can read enrollment for their course", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(getDoc(doc(db, "enrollments", "enr1")));
  });

  it("client cannot create enrollment", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(setDoc(doc(db, "enrollments", "enr2"), {
      student_id: studentUid,
      instructor_id: instructorUid,
      course_id: "course2",
    }));
  });

  it("student can update progress fields", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(updateDoc(doc(db, "enrollments", "enr1"), {
      progress: 50,
      completed_lessons: ["lesson1"],
      last_lesson_id: "lesson1",
    }));
  });

  it("student cannot update non-progress fields", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(updateDoc(doc(db, "enrollments", "enr1"), { student_id: "hacker" }));
  });

  it("admin can delete enrollment", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(deleteDoc(doc(db, "enrollments", "enr1")));
  });

  it("student cannot delete enrollment", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(deleteDoc(doc(db, "enrollments", "enr1")));
  });
});

// ──────────────────── TRANSACTIONS ────────────────────

describe("transactions", () => {
  beforeEach(async () => {
    await seedDoc("profiles", "admin1", { role: "admin", status: "active" });
    await seedDoc("transactions", "tx1", { student_id: "student1", instructor_id: "instructor1", amount: 100 });
  });

  it("student can read own transaction", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertSucceeds(getDoc(doc(db, "transactions", "tx1")));
  });

  it("nobody can write transactions", async () => {
    const db = testEnv.authenticatedContext("admin1").firestore();
    await assertFails(setDoc(doc(db, "transactions", "tx2"), { student_id: "student1", amount: 50 }));
  });
});

// ──────────────────── COUPONS ────────────────────

describe("coupons", () => {
  const instructorUid = "instructor1";
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("profiles", instructorUid, { role: "instructor", status: "active" });
    await seedDoc("courses", "course1", { instructor_id: instructorUid, title: "Course 1" });
    await seedDoc("courses", "course2", { instructor_id: "other_instructor", title: "Course 2" });
    await seedDoc("coupons", "coupon1", { instructor_id: instructorUid, course_id: "course1", usage_count: 5, discount: 10 });
  });

  it("authenticated user can read coupons", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertSucceeds(getDoc(doc(db, "coupons", "coupon1")));
  });

  it("instructor can create coupon for own course", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(setDoc(doc(db, "coupons", "coupon2"), {
      instructor_id: instructorUid,
      course_id: "course1",
      discount: 20,
      code: "TEST20",
    }));
  });

  it("instructor cannot create coupon for other's course", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(setDoc(doc(db, "coupons", "coupon3"), {
      instructor_id: instructorUid,
      course_id: "course2",
      discount: 20,
    }));
  });

  it("instructor can create coupon with course_id='all'", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(setDoc(doc(db, "coupons", "coupon_all"), {
      instructor_id: instructorUid,
      course_id: "all",
      discount: 10,
    }));
  });

  it("instructor cannot create coupon without course_id", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(setDoc(doc(db, "coupons", "coupon_noid"), {
      instructor_id: instructorUid,
      discount: 20,
    }));
  });

  it("instructor cannot modify usage_count", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(updateDoc(doc(db, "coupons", "coupon1"), { usage_count: 999 }));
  });

  it("admin can create coupon freely", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(setDoc(doc(db, "coupons", "admin_coupon"), {
      instructor_id: "anyone",
      discount: 50,
    }));
  });
});

// ──────────────────── WALLET REQUESTS ────────────────────

describe("wallet_requests", () => {
  beforeEach(async () => {
    await seedDoc("profiles", "admin1", { role: "admin", status: "active" });
    await seedDoc("wallet_requests", "wr1", { student_id: "student1", amount: 100, status: "pending" });
  });

  it("student can read own wallet request", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertSucceeds(getDoc(doc(db, "wallet_requests", "wr1")));
  });

  it("client cannot create wallet request", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertFails(setDoc(doc(db, "wallet_requests", "wr2"), { student_id: "student1", amount: 50 }));
  });

  it("client cannot update wallet request", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertFails(updateDoc(doc(db, "wallet_requests", "wr1"), { amount: 9999 }));
  });
});

// ──────────────────── WITHDRAWAL REQUESTS ────────────────────

describe("withdrawal_requests", () => {
  const instructorUid = "instructor1";
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("profiles", instructorUid, { role: "instructor", status: "active" });
    await seedDoc("withdrawal_requests", "wd1", { instructor_id: instructorUid, amount: 500, status: "pending" });
  });

  it("instructor can read own withdrawal request", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(getDoc(doc(db, "withdrawal_requests", "wd1")));
  });

  it("client cannot create withdrawal request (allow create: if false)", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(setDoc(doc(db, "withdrawal_requests", "wd2"), {
      instructor_id: instructorUid,
      amount: 300,
      status: "pending",
    }));
  });

  it("admin can update withdrawal request", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(updateDoc(doc(db, "withdrawal_requests", "wd1"), { status: "paid" }));
  });

  it("instructor cannot update withdrawal request", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(updateDoc(doc(db, "withdrawal_requests", "wd1"), { status: "paid" }));
  });

  it("nobody can delete withdrawal request", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertFails(deleteDoc(doc(db, "withdrawal_requests", "wd1")));
  });
});

// ──────────────────── COURSES ────────────────────

describe("courses", () => {
  const instructorUid = "instructor1";
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("profiles", instructorUid, { role: "instructor", status: "active" });
    await seedDoc("courses", "course1", {
      instructor_id: instructorUid,
      title: "Course 1",
      price: 100,
      status: "approved",
      students_count: 5,
      is_published: true,
    });
    await seedDoc("courses", "course_empty", {
      instructor_id: instructorUid,
      title: "Empty Course",
      price: 50,
      status: "pending",
      students_count: 0,
    });
  });

  it("anyone can read courses (public)", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "courses", "course1")));
  });

  it("instructor can create course with pending status", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(setDoc(doc(db, "courses", "newcourse"), {
      instructor_id: instructorUid,
      title: "New Course",
      price: 200,
      status: "pending",
      students_count: 0,
    }));
  });

  it("instructor cannot create course with is_published", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(setDoc(doc(db, "courses", "badcourse"), {
      instructor_id: instructorUid,
      title: "Bad Course",
      status: "pending",
      is_published: true,
    }));
  });

  it("instructor cannot create course with instructor_verified", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(setDoc(doc(db, "courses", "badcourse2"), {
      instructor_id: instructorUid,
      title: "Bad",
      status: "pending",
      instructor_verified: true,
    }));
  });

  it("instructor cannot create course with rating", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(setDoc(doc(db, "courses", "badcourse3"), {
      instructor_id: instructorUid,
      title: "Bad",
      status: "pending",
      rating: 5,
    }));
  });

  it("instructor cannot create course with non-pending status", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(setDoc(doc(db, "courses", "badcourse4"), {
      instructor_id: instructorUid,
      title: "Bad",
      status: "approved",
    }));
  });

  it("instructor can update own course title", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(updateDoc(doc(db, "courses", "course1"), { title: "Updated Title" }));
  });

  it("instructor cannot update students_count", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(updateDoc(doc(db, "courses", "course1"), { students_count: 999 }));
  });

  it("instructor cannot update status", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(updateDoc(doc(db, "courses", "course1"), { status: "approved" }));
  });

  it("instructor cannot update is_published", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(updateDoc(doc(db, "courses", "course1"), { is_published: false }));
  });

  it("instructor cannot update price", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(updateDoc(doc(db, "courses", "course1"), { price: 999 }));
  });

  it("instructor cannot update rating", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(updateDoc(doc(db, "courses", "course1"), { rating: 5 }));
  });

  it("instructor cannot update instructor_verified", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(updateDoc(doc(db, "courses", "course1"), { instructor_verified: true }));
  });

  it("instructor cannot change instructor_id", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(updateDoc(doc(db, "courses", "course1"), { instructor_id: "hacker" }));
  });

  it("instructor can delete own course with 0 students", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(deleteDoc(doc(db, "courses", "course_empty")));
  });

  it("instructor cannot delete course with students > 0", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(deleteDoc(doc(db, "courses", "course1")));
  });

  it("admin can delete course even with students", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(deleteDoc(doc(db, "courses", "course1")));
  });

  it("admin can update any field", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(updateDoc(doc(db, "courses", "course1"), {
      status: "approved",
      is_published: true,
      price: 999,
    }));
  });

  it("private subcollection is server-only", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertFails(getDoc(doc(db, "courses", "course1", "private", "media")));
  });
});

// ──────────────────── VIDEO PROGRESS ────────────────────

describe("video_progress", () => {
  const studentUid = "student1";
  const otherStudent = "student2";
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("video_progress", "vp1", { student_id: studentUid, video_id: "v1", progress: 50 });
  });

  it("student can read own video progress", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(getDoc(doc(db, "video_progress", "vp1")));
  });

  it("other student cannot read another's video progress", async () => {
    const db = testEnv.authenticatedContext(otherStudent).firestore();
    await assertFails(getDoc(doc(db, "video_progress", "vp1")));
  });

  it("student can create own video progress", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(setDoc(doc(db, "video_progress", "vp_new"), {
      student_id: studentUid,
      video_id: "v2",
      progress: 0,
    }));
  });

  it("student cannot create progress with other's student_id", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(setDoc(doc(db, "video_progress", "vp_fake"), {
      student_id: otherStudent,
      video_id: "v2",
      progress: 0,
    }));
  });

  it("student can update own video progress", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(updateDoc(doc(db, "video_progress", "vp1"), { progress: 80 }));
  });

  it("student cannot update and change student_id", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(updateDoc(doc(db, "video_progress", "vp1"), { student_id: "hacker" }));
  });

  it("other student cannot update another's video progress", async () => {
    const db = testEnv.authenticatedContext(otherStudent).firestore();
    await assertFails(updateDoc(doc(db, "video_progress", "vp1"), { progress: 100 }));
  });

  it("student can delete own video progress", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(deleteDoc(doc(db, "video_progress", "vp1")));
  });

  it("other student cannot delete another's video progress", async () => {
    const db = testEnv.authenticatedContext(otherStudent).firestore();
    await assertFails(deleteDoc(doc(db, "video_progress", "vp1")));
  });

  it("admin can read any video progress", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(getDoc(doc(db, "video_progress", "vp1")));
  });
});

// ──────────────────── SUBMISSIONS ────────────────────

describe("submissions", () => {
  const studentUid = "student1";
  const instructorUid = "instructor1";
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("profiles", instructorUid, { role: "instructor", status: "active" });
    await seedDoc("profiles", studentUid, { role: "student", status: "active" });
    await seedDoc("courses", "course1", { instructor_id: instructorUid, title: "Course" });
    await seedDoc("submissions", "sub1", {
      student_id: studentUid,
      instructor_id: instructorUid,
      course_id: "course1",
      answers: {},
      needs_grading: true,
    });
  });

  it("student can read own submission", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(getDoc(doc(db, "submissions", "sub1")));
  });

  it("instructor can read submissions for their course", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(getDoc(doc(db, "submissions", "sub1")));
  });

  it("student can create submission with valid instructor_id", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(setDoc(doc(db, "submissions", "sub2"), {
      student_id: studentUid,
      instructor_id: instructorUid,
      course_id: "course1",
      answers: { q1: "a" },
    }));
  });

  it("student cannot create submission with spoofed instructor_id", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(setDoc(doc(db, "submissions", "sub_bad"), {
      student_id: studentUid,
      instructor_id: "fake_instructor",
      course_id: "course1",
      answers: {},
    }));
  });

  it("instructor can update submission (grade)", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(updateDoc(doc(db, "submissions", "sub1"), {
      score: 85,
      needs_grading: false,
    }));
  });

  it("student cannot update submission", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertFails(updateDoc(doc(db, "submissions", "sub1"), { score: 100 }));
  });

  it("only admin can delete submission", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(deleteDoc(doc(db, "submissions", "sub1")));
  });
});

// ──────────────────── SETTINGS ────────────────────

describe("settings", () => {
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("settings", "support", { phone: "123", email: "a@b.com" });
    await seedDoc("settings", "fawaterak", { api_key: "secret" });
  });

  it("anyone can read settings/support", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "settings", "support")));
  });

  it("unauthenticated cannot read settings/fawaterak", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "settings", "fawaterak")));
  });

  it("non-admin cannot read settings/fawaterak", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertFails(getDoc(doc(db, "settings", "fawaterak")));
  });

  it("admin can read settings/fawaterak", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(getDoc(doc(db, "settings", "fawaterak")));
  });

  it("admin can write settings", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(updateDoc(doc(db, "settings", "support"), { phone: "456" }));
  });

  it("non-admin cannot write settings", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertFails(updateDoc(doc(db, "settings", "support"), { phone: "hacked" }));
  });
});

// ──────────────────── ACTIVITY LOGS ────────────────────

describe("activity_logs", () => {
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("activity_logs", "log1", { user_id: "student1", action: "login" });
  });

  it("admin can read activity logs", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(getDoc(doc(db, "activity_logs", "log1")));
  });

  it("non-admin cannot read activity logs", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertFails(getDoc(doc(db, "activity_logs", "log1")));
  });

  it("authenticated user can create log with own user_id", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertSucceeds(setDoc(doc(db, "activity_logs", "log2"), {
      user_id: "student1",
      action: "page_view",
    }));
  });

  it("authenticated user cannot create log with other user_id", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertFails(setDoc(doc(db, "activity_logs", "log3"), {
      user_id: "hacker",
      action: "steal_data",
    }));
  });

  it("nobody can update activity logs", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertFails(updateDoc(doc(db, "activity_logs", "log1"), { action: "modified" }));
  });

  it("nobody can delete activity logs", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertFails(deleteDoc(doc(db, "activity_logs", "log1")));
  });
});

// ──────────────────── SYSTEM ────────────────────

describe("system", () => {
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("system", "stats", { total_users: 100 });
  });

  it("admin can read system docs", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertSucceeds(getDoc(doc(db, "system", "stats")));
  });

  it("non-admin cannot read system docs", async () => {
    const db = testEnv.authenticatedContext("student1").firestore();
    await assertFails(getDoc(doc(db, "system", "stats")));
  });

  it("nobody can write system docs", async () => {
    const db = testEnv.authenticatedContext(adminUid).firestore();
    await assertFails(updateDoc(doc(db, "system", "stats"), { total_users: 999 }));
  });
});

// ──────────────────── PARENT REPORTS ────────────────────

describe("parent_reports", () => {
  const instructorUid = "instructor1";
  const studentUid = "student1";
  const adminUid = "admin1";

  beforeEach(async () => {
    await seedDoc("profiles", adminUid, { role: "admin", status: "active" });
    await seedDoc("profiles", instructorUid, { role: "instructor", status: "active" });
    await seedDoc("profiles", studentUid, { role: "student", status: "active" });
    await seedDoc("parent_reports", "rpt1", {
      instructor_id: instructorUid,
      student_id: studentUid,
      content: "Good progress",
    });
  });

  it("instructor can read own report", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(getDoc(doc(db, "parent_reports", "rpt1")));
  });

  it("student can read own report", async () => {
    const db = testEnv.authenticatedContext(studentUid).firestore();
    await assertSucceeds(getDoc(doc(db, "parent_reports", "rpt1")));
  });

  it("instructor can create report with own id", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertSucceeds(setDoc(doc(db, "parent_reports", "rpt2"), {
      instructor_id: instructorUid,
      student_id: studentUid,
      content: "New report",
    }));
  });

  it("instructor cannot create report with other's id", async () => {
    const db = testEnv.authenticatedContext(instructorUid).firestore();
    await assertFails(setDoc(doc(db, "parent_reports", "rpt_bad"), {
      instructor_id: "other_instructor",
      student_id: studentUid,
    }));
  });
});

// ──────────────────── DEFAULT DENY ────────────────────

describe("default deny", () => {
  it("unknown collection is denied", async () => {
    const db = testEnv.authenticatedContext("anyone").firestore();
    await assertFails(getDoc(doc(db, "unknown_collection", "doc1")));
  });

  it("unknown collection write is denied", async () => {
    const db = testEnv.authenticatedContext("anyone").firestore();
    await assertFails(setDoc(doc(db, "unknown_collection", "doc1"), { data: "test" }));
  });
});
