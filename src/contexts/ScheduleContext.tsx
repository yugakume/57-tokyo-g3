"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import type { StaffProfile, TimeSlot, Booking, EventType, BookingStatus, StaffRole } from "@/types";
import { DEFAULT_STAFF_ROLES } from "@/types";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch } from "firebase/firestore";

// =============================================
// ScheduleContext
// =============================================

interface ScheduleContextType {
  staffProfiles: StaffProfile[];
  timeSlots: TimeSlot[];
  bookings: Booking[];
  staffRoles: StaffRole[];
  // ロール管理
  addStaffRole: (name: string) => void;
  updateStaffRole: (id: string, updates: Partial<StaffRole>) => void;
  deleteStaffRole: (id: string) => void;
  // スタッフプロフィール
  addStaffProfile: (profile: Omit<StaffProfile, "id">) => void;
  updateStaffProfile: (id: string, updates: Partial<StaffProfile>) => void;
  deleteStaffProfile: (id: string) => void;
  // タイムスロット
  addTimeSlot: (slot: Omit<TimeSlot, "id">) => void;
  addTimeSlots: (slots: Omit<TimeSlot, "id">[]) => void;
  deleteTimeSlot: (id: string) => void;
  getSlotsByStaff: (staffId: string) => TimeSlot[];
  getAvailableSlots: (eventType?: EventType) => TimeSlot[];
  // 予約
  createBooking: (booking: Omit<Booking, "id" | "bookingNumber" | "status" | "createdAt" | "updatedAt">) => Booking;
  confirmBooking: (bookingId: string, confirmedSlotId: string, assignedStaffId: string, meetLink?: string) => void;
  cancelBooking: (bookingId: string) => void;
  getBookingByNumber: (bookingNumber: string, studentEmail: string) => Booking | undefined;
  updateBookingSlots: (bookingId: string, newSlotIds: string[]) => void;
}

const ScheduleContext = createContext<ScheduleContextType | undefined>(undefined);

// =============================================
// 予約番号生成
// =============================================

function generateBookingNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "BK-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// =============================================
// デモデータ
// =============================================

const DEFAULT_STAFF: StaffProfile[] = [
  { id: "staff-0", email: "yuga_kume@dot-jp.or.jp", lastName: "久米", firstName: "悠雅", fullName: "久米悠雅", furigana: "くめゆうが", grade: "3年", gender: "male" as const, roleIds: ["role-01"], nearestStation: "東京駅", birthday: "08-15", university: "早稲田大学", faculty: "政治経済学部 経済学科" },
  { id: "staff-1", email: "tanaka@dot-jp.or.jp", lastName: "田中", firstName: "太郎", fullName: "田中太郎", furigana: "たなかたろう", grade: "3年", gender: "male", roleIds: ["role-03"], nearestStation: "渋谷駅", birthday: "05-10", university: "慶應義塾大学", faculty: "法学部 法律学科" },
  { id: "staff-2", email: "sato@dot-jp.or.jp", lastName: "佐藤", firstName: "花子", fullName: "佐藤花子", furigana: "さとうはなこ", grade: "2年", gender: "female", roleIds: ["role-04"], nearestStation: "新宿駅", birthday: "03-21", university: "上智大学", faculty: "総合グローバル学部" },
  { id: "staff-3", email: "suzuki@dot-jp.or.jp", lastName: "鈴木", firstName: "一郎", fullName: "鈴木一郎", furigana: "すずきいちろう", grade: "4年", gender: "male", roleIds: ["role-01", "role-08"], nearestStation: "池袋駅", birthday: "11-03", university: "東京大学", faculty: "文学部 社会学科" },
];

function generateDefaultSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const today = new Date();
  const timeRanges = [
    { start: "10:00", end: "11:00" },
    { start: "10:30", end: "11:30" },
    { start: "11:00", end: "12:00" },
    { start: "11:30", end: "12:30" },
    { start: "13:00", end: "14:00" },
    { start: "13:30", end: "14:30" },
    { start: "14:00", end: "15:00" },
    { start: "14:30", end: "15:30" },
    { start: "15:00", end: "16:00" },
    { start: "15:30", end: "16:30" },
    { start: "16:00", end: "17:00" },
  ];

  let slotIndex = 1;
  for (let day = 1; day <= 7; day++) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);
    const dateStr = date.toISOString().split("T")[0];

    for (const staff of DEFAULT_STAFF) {
      const staffTimes = timeRanges.filter((_, i) => {
        const seed = day * 10 + parseInt(staff.id.split("-")[1]) + i;
        return seed % 4 !== 0;
      });

      for (const time of staffTimes) {
        slots.push({
          id: `slot-${slotIndex++}`,
          staffId: staff.id,
          date: dateStr,
          startTime: time.start,
          endTime: time.end,
          eventType: "orientation",
          isBooked: false,
        });
      }
    }
  }

  if (slots.length >= 5) {
    slots[0].isBooked = true;
    slots[0].bookingId = "booking-1";
    slots[2].isBooked = true;
    slots[2].bookingId = "booking-2";
  }

  return slots;
}

function generateDefaultBookings(slots: TimeSlot[]): Booking[] {
  const now = new Date().toISOString();
  const bookings: Booking[] = [];

  const pendingSlotIds = slots.filter(s => !s.isBooked).slice(0, 3).map(s => s.id);
  bookings.push({
    id: "booking-1",
    bookingNumber: "BK-D3M0A1",
    studentName: "山田太郎",
    studentEmail: "yamada@example.com",
    selectedSlotIds: pendingSlotIds,
    eventType: "orientation",
    status: "pending" as BookingStatus,
    createdAt: now,
    updatedAt: now,
  });

  const confirmedSlot = slots.find(s => s.isBooked && s.bookingId === "booking-2");
  bookings.push({
    id: "booking-2",
    bookingNumber: "BK-D3M0B2",
    studentName: "鈴木花子",
    studentEmail: "suzuki.hanako@example.com",
    selectedSlotIds: confirmedSlot ? [confirmedSlot.id] : [],
    confirmedSlotId: confirmedSlot?.id,
    assignedStaffId: confirmedSlot?.staffId,
    eventType: "orientation",
    meetLink: "https://meet.google.com/abc-defg-hij",
    status: "confirmed" as BookingStatus,
    createdAt: now,
    updatedAt: now,
  });

  return bookings;
}

// =============================================
// Provider
// =============================================

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);

  const [loaded, setLoaded] = useState(false);

  // Firestoreリアルタイムリスナー（全コレクション）
  useEffect(() => {
    const defaultSlots = generateDefaultSlots();
    const defaultBookings = generateDefaultBookings(defaultSlots);

    const unsubs: (() => void)[] = [];
    let profilesLoaded = false;
    let slotsLoaded = false;
    let bookingsLoaded = false;
    let rolesLoaded = false;

    // staffProfiles
    unsubs.push(onSnapshot(collection(db, "staffProfiles"), (snap) => {
      if (snap.empty && !profilesLoaded) {
        const batch = writeBatch(db);
        DEFAULT_STAFF.forEach(s => {
          const { id, ...data } = s;
          batch.set(doc(db, "staffProfiles", id), data);
        });
        batch.commit();
        profilesLoaded = true;
        checkLoaded();
        return;
      }
      setStaffProfiles(snap.docs.map(d => ({ ...d.data(), id: d.id })) as StaffProfile[]);
      profilesLoaded = true;
      checkLoaded();
    }));

    // timeSlots
    unsubs.push(onSnapshot(collection(db, "timeSlots"), (snap) => {
      if (snap.empty && !slotsLoaded) {
        const batch = writeBatch(db);
        defaultSlots.forEach(s => {
          const { id, ...data } = s;
          batch.set(doc(db, "timeSlots", id), data);
        });
        batch.commit();
        slotsLoaded = true;
        checkLoaded();
        return;
      }
      setTimeSlots(snap.docs.map(d => ({ ...d.data(), id: d.id })) as TimeSlot[]);
      slotsLoaded = true;
      checkLoaded();
    }));

    // bookings
    unsubs.push(onSnapshot(collection(db, "bookings"), (snap) => {
      if (snap.empty && !bookingsLoaded) {
        const batch = writeBatch(db);
        defaultBookings.forEach(b => {
          const { id, ...data } = b;
          batch.set(doc(db, "bookings", id), data);
        });
        batch.commit();
        bookingsLoaded = true;
        checkLoaded();
        return;
      }
      setBookings(snap.docs.map(d => ({ ...d.data(), id: d.id })) as Booking[]);
      bookingsLoaded = true;
      checkLoaded();
    }));

    // staffRoles
    unsubs.push(onSnapshot(collection(db, "staffRoles"), (snap) => {
      if (snap.empty && !rolesLoaded) {
        const batch = writeBatch(db);
        DEFAULT_STAFF_ROLES.forEach(r => {
          const { id, ...data } = r;
          batch.set(doc(db, "staffRoles", id), data);
        });
        batch.commit();
        rolesLoaded = true;
        checkLoaded();
        return;
      }
      setStaffRoles(snap.docs.map(d => ({ ...d.data(), id: d.id })) as StaffRole[]);
      rolesLoaded = true;
      checkLoaded();
    }));

    function checkLoaded() {
      if (profilesLoaded && slotsLoaded && bookingsLoaded && rolesLoaded) setLoaded(true);
    }

    return () => unsubs.forEach(u => u());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // =============================================
  // ロール管理
  // =============================================

  const addStaffRole = useCallback((name: string) => {
    const id = crypto.randomUUID();
    const newRole: StaffRole = { id, name, order: staffRoles.length + 1 };
    setStaffRoles(prev => [...prev, newRole]);
    const { id: roleId, ...data } = newRole;
    setDoc(doc(db, "staffRoles", roleId), data);
  }, [staffRoles.length]);

  const updateStaffRole = useCallback((id: string, updates: Partial<StaffRole>) => {
    setStaffRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setDoc(doc(db, "staffRoles", id), updates, { merge: true });
  }, []);

  const deleteStaffRole = useCallback((id: string) => {
    setStaffRoles(prev => prev.filter(r => r.id !== id));
    deleteDoc(doc(db, "staffRoles", id));
    // スタッフプロフィールから削除されたロールIDを除去
    setStaffProfiles(prev => {
      const newProfiles = prev.map(p => ({
        ...p,
        roleIds: p.roleIds.filter(rid => rid !== id),
      }));
      newProfiles.forEach(p => {
        const { id: pId, ...data } = p;
        setDoc(doc(db, "staffProfiles", pId), data);
      });
      return newProfiles;
    });
  }, []);

  // =============================================
  // スタッフプロフィール
  // =============================================

  const addStaffProfile = useCallback((profile: Omit<StaffProfile, "id">) => {
    const id = crypto.randomUUID();
    const data = { ...profile, id };
    setStaffProfiles(prev => [...prev, data as StaffProfile]);
    const { id: _id, ...rest } = data;
    setDoc(doc(db, "staffProfiles", id), rest);
  }, []);

  const updateStaffProfile = useCallback((id: string, updates: Partial<StaffProfile>) => {
    setStaffProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    setDoc(doc(db, "staffProfiles", id), updates, { merge: true });
  }, []);

  const deleteStaffProfile = useCallback((id: string) => {
    setStaffProfiles(prev => prev.filter(p => p.id !== id));
    deleteDoc(doc(db, "staffProfiles", id));
  }, []);

  // =============================================
  // タイムスロット
  // =============================================

  const addTimeSlot = useCallback((slot: Omit<TimeSlot, "id">) => {
    const id = crypto.randomUUID();
    const newSlot = { ...slot, id };
    setTimeSlots(prev => [...prev, newSlot]);
    const { id: _id, ...data } = newSlot;
    setDoc(doc(db, "timeSlots", id), data);
  }, []);

  const addTimeSlots = useCallback((slots: Omit<TimeSlot, "id">[]) => {
    const newSlots = slots.map(slot => ({ ...slot, id: crypto.randomUUID() }));
    setTimeSlots(prev => [...prev, ...newSlots]);
    const batch = writeBatch(db);
    newSlots.forEach(s => {
      const { id, ...data } = s;
      batch.set(doc(db, "timeSlots", id), data);
    });
    batch.commit();
  }, []);

  const deleteTimeSlot = useCallback((id: string) => {
    setTimeSlots(prev => prev.filter(s => s.id !== id));
    deleteDoc(doc(db, "timeSlots", id));
  }, []);

  const getSlotsByStaff = useCallback((staffId: string) => {
    return timeSlots.filter(s => s.staffId === staffId);
  }, [timeSlots]);

  const getAvailableSlots = useCallback((eventType?: EventType) => {
    return timeSlots.filter(s => {
      if (s.isBooked) return false;
      if (eventType && s.eventType !== eventType) return false;
      return true;
    });
  }, [timeSlots]);

  // =============================================
  // 予約
  // =============================================

  const createBooking = useCallback((booking: Omit<Booking, "id" | "bookingNumber" | "status" | "createdAt" | "updatedAt">): Booking => {
    const now = new Date().toISOString();
    const newBooking: Booking = {
      ...booking,
      id: crypto.randomUUID(),
      bookingNumber: generateBookingNumber(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    setBookings(prev => [...prev, newBooking]);
    const { id, ...data } = newBooking;
    setDoc(doc(db, "bookings", id), data);

    return newBooking;
  }, []);

  const confirmBooking = useCallback((bookingId: string, confirmedSlotId: string, assignedStaffId: string, meetLink?: string) => {
    const now = new Date().toISOString();

    // 予約を確定
    setBookings(prev => {
      const newBookings = prev.map(b =>
        b.id === bookingId
          ? {
              ...b,
              confirmedSlotId,
              assignedStaffId,
              meetLink,
              status: "confirmed" as BookingStatus,
              updatedAt: now,
            }
          : b
      );
      return newBookings;
    });
    setDoc(doc(db, "bookings", bookingId), {
      confirmedSlotId,
      assignedStaffId,
      meetLink,
      status: "confirmed" as BookingStatus,
      updatedAt: now,
    }, { merge: true });

    // 対象スロットを予約済みに
    setTimeSlots(prev => {
      const newSlots = prev.map(s =>
        s.id === confirmedSlotId
          ? { ...s, isBooked: true, bookingId }
          : s
      );
      return newSlots;
    });
    setDoc(doc(db, "timeSlots", confirmedSlotId), {
      isBooked: true,
      bookingId,
    }, { merge: true });
  }, []);

  const cancelBooking = useCallback((bookingId: string) => {
    const now = new Date().toISOString();

    setBookings(prev => {
      const booking = prev.find(b => b.id === bookingId);
      const newBookings = prev.map(b =>
        b.id === bookingId
          ? { ...b, status: "cancelled" as BookingStatus, updatedAt: now }
          : b
      );

      // 確定済みスロットがあれば解放
      if (booking?.confirmedSlotId) {
        setTimeSlots(prevSlots => {
          const newSlots = prevSlots.map(s =>
            s.id === booking.confirmedSlotId
              ? { ...s, isBooked: false, bookingId: undefined }
              : s
          );
          return newSlots;
        });
        setDoc(doc(db, "timeSlots", booking.confirmedSlotId), {
          isBooked: false,
          bookingId: null,
        }, { merge: true });
      }

      return newBookings;
    });
    setDoc(doc(db, "bookings", bookingId), {
      status: "cancelled" as BookingStatus,
      updatedAt: now,
    }, { merge: true });
  }, []);

  const getBookingByNumber = useCallback((bookingNumber: string, studentEmail: string): Booking | undefined => {
    return bookings.find(
      b => b.bookingNumber === bookingNumber && b.studentEmail === studentEmail
    );
  }, [bookings]);

  const updateBookingSlots = useCallback((bookingId: string, newSlotIds: string[]) => {
    const now = new Date().toISOString();

    setBookings(prev => {
      const newBookings = prev.map(b =>
        b.id === bookingId
          ? { ...b, selectedSlotIds: newSlotIds, updatedAt: now }
          : b
      );
      return newBookings;
    });
    setDoc(doc(db, "bookings", bookingId), {
      selectedSlotIds: newSlotIds,
      updatedAt: now,
    }, { merge: true });
  }, []);

  return (
    <ScheduleContext.Provider value={{
      staffProfiles, timeSlots, bookings, staffRoles,
      addStaffRole, updateStaffRole, deleteStaffRole,
      addStaffProfile, updateStaffProfile, deleteStaffProfile,
      addTimeSlot, addTimeSlots, deleteTimeSlot, getSlotsByStaff, getAvailableSlots,
      createBooking, confirmBooking, cancelBooking, getBookingByNumber, updateBookingSlots,
    }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (context === undefined) {
    throw new Error("useSchedule must be used within a ScheduleProvider");
  }
  return context;
}
