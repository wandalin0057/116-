import { describe, expect, it } from "vitest";
import { addCalendarDays, dayOfWeek, parseTaipeiDateTime, taipeiDateOf, taipeiToday } from "@/lib/dates";
import { BusinessDayService } from "@/server/business-days/business-day-service";
import { bds2026, calendar2026Data } from "../helpers/calendar";

const bds = bds2026();

describe("BusinessDayService 工作天計算", () => {
  it("1. 週五會議，後 1 工作天為下週一", () => {
    expect(dayOfWeek("2026-10-16")).toBe(5);
    expect(bds.addBusinessDays("2026-10-16", 1)).toEqual({ date: "2026-10-19", estimated: false });
  });

  it("2. 週一發文，前 1 工作天為上週五", () => {
    expect(dayOfWeek("2026-10-19")).toBe(1);
    expect(bds.addBusinessDays("2026-10-19", -1).date).toBe("2026-10-16");
  });

  it("3. 遇到官方休假日正確跳過", () => {
    // 10/9（五）國慶日補假 → 下一工作天 10/12（一）
    expect(bds.addBusinessDays("2026-10-08", 1).date).toBe("2026-10-12");
    // 9/25（五）中秋、9/28（一）教師節 → 9/29（二）
    expect(bds.addBusinessDays("2026-09-24", 1).date).toBe("2026-09-29");
    // 春節 2/14–2/22 連假
    expect(bds.addBusinessDays("2026-02-13", 1).date).toBe("2026-02-23");
    expect(bds.isBusinessDay("2026-02-20")).toBe(false);
    expect(bds.getDayInfo("2026-10-26").description).toContain("補假");
  });

  it("4. 遇到補行上班日正確計算", () => {
    // 2025-02-08（六）補行上班
    expect(bds.isBusinessDay("2025-02-08")).toBe(true);
    expect(bds.addBusinessDays("2025-02-07", 1).date).toBe("2025-02-08");
    expect(bds.addBusinessDays("2025-02-10", -1).date).toBe("2025-02-08");
    // 春節調整放假 1/27（一）不上班
    expect(bds.addBusinessDays("2025-01-24", 1).date).toBe("2025-02-03");
  });

  it("5. 機關通知後 12 工作天正確計算", () => {
    // 10/14（三）D0；10/26（一）光復節補假不計
    expect(bds.addBusinessDays("2026-10-14", 12).date).toBe("2026-11-02");
    // 跨春節與和平紀念日補假
    expect(bds.addBusinessDays("2026-02-10", 12).date).toBe("2026-03-06");
  });

  it("6. 會議前 2 工作天正確計算", () => {
    // 10/27（二）會議，10/26 補假 → 前 1 為 10/23、前 2 為 10/22
    expect(bds.addBusinessDays("2026-10-27", -2).date).toBe("2026-10-22");
    expect(bds.addBusinessDays("2026-11-04", -2).date).toBe("2026-11-02");
  });

  it("7. 會議後 1 及 3 工作天正確計算", () => {
    expect(bds.addBusinessDays("2026-10-22", 1).date).toBe("2026-10-23");
    expect(bds.addBusinessDays("2026-10-22", 3).date).toBe("2026-10-28");
  });

  it("8. 會勘前 2 及後 1、3 工作天正確計算", () => {
    // 4/8（三）會勘；4/3（五）、4/6（一）補假
    expect(bds.addBusinessDays("2026-04-08", -2).date).toBe("2026-04-02");
    expect(bds.addBusinessDays("2026-04-08", 1).date).toBe("2026-04-09");
    expect(bds.addBusinessDays("2026-04-08", 3).date).toBe("2026-04-13");
  });

  it("事件當日為 D0：位移 0 回傳當日", () => {
    expect(bds.addBusinessDays("2026-10-17", 0).date).toBe("2026-10-17");
  });

  it("未取得完整官方日曆之年度標示暫估，不自行猜測假日", () => {
    const r = bds.addBusinessDays("2026-12-30", 3);
    expect(r.estimated).toBe(true);
    // 2027 年無資料：僅排除週末（12/31 四、1/1 五 皆視為工作天）
    expect(r.date).toBe("2027-01-04");
    expect(bds.addBusinessDays("2026-12-01", 3).estimated).toBe(false);
    expect(BusinessDayService.empty().addBusinessDays("2026-10-16", 1)).toEqual({ date: "2026-10-19", estimated: true });
  });

  it("管理員手動調整優先於官方日曆", () => {
    const data = calendar2026Data();
    data.overrides.set("2026-10-19", { kind: "HOLIDAY", reason: "颱風停班" });
    data.overrides.set("2026-10-24", { kind: "MAKEUP_WORKDAY", reason: "測試補班" });
    const s = new BusinessDayService(data);
    expect(s.addBusinessDays("2026-10-16", 1).date).toBe("2026-10-20");
    expect(s.addBusinessDays("2026-10-23", 1).date).toBe("2026-10-24");
  });

  it("剩餘工作天：今日 0、未來為正、逾期為負", () => {
    expect(bds.businessDaysBetween("2026-10-16", "2026-10-16")).toBe(0);
    expect(bds.businessDaysBetween("2026-10-16", "2026-10-19")).toBe(1);
    expect(bds.businessDaysBetween("2026-10-08", "2026-10-13")).toBe(2);
    expect(bds.businessDaysBetween("2026-10-19", "2026-10-16")).toBe(-1);
  });
});

describe("日期工具與臺北時區", () => {
  it("使用曆法運算而非固定毫秒數", () => {
    expect(addCalendarDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("以 Asia/Taipei 判定日期", () => {
    // UTC 2026-10-15 17:00 = 臺北 10/16 01:00
    expect(taipeiDateOf(new Date("2026-10-15T17:00:00Z"))).toBe("2026-10-16");
    expect(taipeiToday(new Date("2026-10-15T15:59:59Z"))).toBe("2026-10-15");
    expect(parseTaipeiDateTime("2026-10-16T08:00").toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });
});
