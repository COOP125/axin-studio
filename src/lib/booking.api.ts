import { supabase } from "@/integrations/supabase/client";
import type { CourseType } from "./schedule";

export interface SlotCount {
  slot_date: string;
  slot_hour: number;
  booked: number;
}

export async function fetchSlotCounts(startDate: string, endDate: string): Promise<SlotCount[]> {
  const { data, error } = await supabase.rpc("get_slot_counts", {
    start_date: startDate,
    end_date: endDate,
  });
  if (error) throw error;
  return (data ?? []) as SlotCount[];
}

export interface CreateBookingInput {
  slot_date: string;
  slot_hour: number;
  course_type: CourseType;
  customer_name: string;
  customer_phone: string;
  note?: string;
}

export async function createBooking(input: CreateBookingInput) {
  const { error } = await supabase.from("bookings").insert({
    slot_date: input.slot_date,
    slot_hour: input.slot_hour,
    course_type: input.course_type,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    note: input.note ?? null,
  });
  if (error) throw error;
}
