import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { COURSE_META, type CourseType } from "@/lib/schedule";
import { createBooking } from "@/lib/booking.api";

interface Props {
  open: boolean;
  onClose: () => void;
  slot: { date: string; hour: number; course: CourseType; weekday: string } | null;
}

export function BookingDialog({ open, onClose, slot }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      toast.success("预约提交成功，期待你的到来。");
      qc.invalidateQueries({ queryKey: ["slot-counts"] });
      setName("");
      setPhone("");
      setNote("");
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "提交失败";
      toast.error(msg.includes("已约满") ? "该时段已约满，请选择其他时段。" : msg);
    },
  });

  if (!open || !slot) return null;

  const meta = COURSE_META[slot.course];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("请填写姓名和手机号");
      return;
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      toast.error("手机号格式有误");
      return;
    }
    mutation.mutate({
      slot_date: slot.date,
      slot_hour: slot.hour,
      course_type: slot.course,
      customer_name: name.trim(),
      customer_phone: phone.trim(),
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md border border-white/10 bg-card p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Confirm Booking · 确认预约
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold text-foreground">{meta.label}</h2>
        <div className="mt-4 flex items-center justify-between border-y border-white/5 py-3 font-mono text-xs text-muted-foreground">
          <span>{slot.date} · {slot.weekday}</span>
          <span className="text-brand">{String(slot.hour).padStart(2, "0")}:00 — {String(slot.hour + 1).padStart(2, "0")}:00</span>
        </div>

        <form className="mt-6 space-y-5" onSubmit={submit}>
          <Field label="姓名 / Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              className="input"
              placeholder="您的真实姓名"
            />
          </Field>
          <Field label="手机号 / Phone" required>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={11}
              className="input"
              placeholder="11 位手机号"
              inputMode="tel"
            />
          </Field>
          <Field label="备注 / Note">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={3}
              className="input resize-none"
              placeholder="过往伤病、训练目标等（可选）"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-white/5"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-[1.4] bg-brand px-4 py-3 text-xs font-bold uppercase tracking-widest text-brand-foreground transition-colors hover:bg-white disabled:opacity-50"
            >
              {mutation.isPending ? "提交中…" : "确认预约"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-brand">*</span>}
      </span>
      {children}
    </label>
  );
}
