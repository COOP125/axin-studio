import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { COURSE_META, type CourseType } from "@/lib/schedule";
import { createTrialBooking } from "@/lib/booking.api";
import { createMemberBooking } from "@/lib/account.functions";

interface Props {
  open: boolean;
  onClose: () => void;
  slot: { date: string; hour: number; course: CourseType; weekday: string } | null;
  mode: "trial" | "member";
  memberPhone?: string;
}

export function BookingDialog({ open, onClose, slot, mode, memberPhone }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const memberBookingFn = useServerFn(createMemberBooking);

  const mutation = useMutation({
    mutationFn: async (input: { slot_date: string; slot_hour: number; course_type: CourseType; note?: string }) => {
      if (mode === "member") {
        await memberBookingFn({ data: input });
      } else {
        await createTrialBooking({
          ...input,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
        });
      }
    },
    onSuccess: () => {
      toast.success(mode === "trial" ? "体验课预约成功，期待您的到来！" : "预约成功，已扣减 1 节课次。");
      qc.invalidateQueries({ queryKey: ["slot-counts"] });
      qc.invalidateQueries({ queryKey: ["account"] });
      setName(""); setPhone(""); setNote("");
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "提交失败";
      if (msg.includes("已约满")) toast.error("该时段已约满，请选择其他时段。");
      else if (msg.includes("剩余次数不足")) toast.error("该课程剩余次数不足，请先购买课程。");
      else if (msg.includes("duplicate") || msg.includes("trial_per_phone")) toast.error("该手机号已使用过免费体验名额。");
      else toast.error(msg);
    },
  });

  if (!open || !slot) return null;

  const meta = COURSE_META[slot.course];
  const trialAllowed = meta.trialAllowed;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "trial") {
      if (!trialAllowed) {
        toast.error("该课程不支持体验预约，请登录会员后预约。");
        return;
      }
      if (!name.trim() || !phone.trim()) { toast.error("请填写姓名和手机号"); return; }
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) { toast.error("手机号格式有误"); return; }
    }
    mutation.mutate({
      slot_date: slot.date,
      slot_hour: slot.hour,
      course_type: slot.course,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md border border-white/10 bg-card p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {mode === "trial" ? "Trial Booking · 体验预约" : "Member Booking · 会员预约"}
        </p>
        <h2 className="mt-2 font-display text-3xl font-bold text-foreground">{meta.label}</h2>
        <div className="mt-4 flex items-center justify-between border-y border-white/5 py-3 font-mono text-xs text-muted-foreground">
          <span>{slot.date} · {slot.weekday}</span>
          <span className="text-brand">{String(slot.hour).padStart(2, "0")}:00 — {String(slot.hour + 1).padStart(2, "0")}:00</span>
        </div>

        {mode === "trial" && !trialAllowed && (
          <p className="mt-4 rounded-md border border-brand/40 bg-brand/5 p-3 text-xs text-brand">
            该课程仅限会员预约，请先登录会员账户。
          </p>
        )}
        {mode === "trial" && trialAllowed && (
          <p className="mt-4 rounded-md border border-brand/30 bg-brand/5 p-3 text-[11px] text-brand">
            本次为免费体验课 · 每个手机号仅限一次
          </p>
        )}
        {mode === "member" && (
          <p className="mt-4 rounded-md border border-white/10 bg-white/5 p-3 text-[11px] text-muted-foreground">
            会员手机：{memberPhone}　· 预约确认后扣减 1 节 {meta.label} 课次
          </p>
        )}

        <form className="mt-6 space-y-5" onSubmit={submit}>
          {mode === "trial" && (
            <>
              <Field label="姓名 / Name" required>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} className="input" placeholder="您的真实姓名" />
              </Field>
              <Field label="手机号 / Phone" required>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={11} className="input" placeholder="11 位手机号" inputMode="tel" />
              </Field>
            </>
          )}
          <Field label="备注 / Note">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={3} className="input resize-none" placeholder="过往伤病、训练目标等（可选）" />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-white/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:bg-white/5">
              取消
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || (mode === "trial" && !trialAllowed)}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label} {required && <span className="text-brand">*</span>}
      </span>
      {children}
    </label>
  );
}
