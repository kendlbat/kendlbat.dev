use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const ROOMS: [(i64, &str); 3] = [(1, "Reissner"), (2, "Tripolt"), (3, "Kendlbacher")];
const DUTIES: [&str; 3] = ["Küche + Müll", "WC", "Bad"];

fn main() {
    print!("{}", plan(today()));
}

fn today() -> i64 {
    let local = Command::new("date").arg("+%Y %m %d").output().ok().and_then(|out| {
        let text = String::from_utf8(out.stdout).ok()?;
        let mut parts = text.split_whitespace().map(|p| p.parse::<i64>().ok());
        Some(days_from_civil(parts.next()??, parts.next()??, parts.next()??))
    });
    local.unwrap_or_else(|| (SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() / 86400) as i64)
}

fn plan(today: i64) -> String {
    let this_monday = today - (today + 3).rem_euclid(7);
    let mut out = String::from("\x1b[1mPutzplan\x1b[0m\n");
    for (label, offset) in [("Aktuelle Woche", 0), ("Nächste Woche", 1)] {
        let monday = this_monday + offset * 7;
        let week = iso_week(monday);
        out += &format!("\n\x1b[1;36m{label} (KW {week})\x1b[0m\n{} - {}\n", short_date(monday), short_date(monday + 6));
        for (number, name) in ROOMS {
            let duty = (week % 3 + number - 1) % 3;
            out += &format!("  • {number} {name}: {}\n", DUTIES[duty as usize]);
        }
    }
    out
}

fn iso_week(monday: i64) -> i64 {
    let thursday = monday + 3;
    let (year, _, _) = civil(thursday);
    (thursday - days_from_civil(year, 1, 1)) / 7 + 1
}

fn short_date(days: i64) -> String {
    let (_, month, day) = civil(days);
    format!("{day}.{month}.")
}

fn civil(days: i64) -> (i64, i64, i64) {
    let z = days + 719468;
    let era = z.div_euclid(146097);
    let doe = z.rem_euclid(146097);
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    (yoe + era * 400 + i64::from(month <= 2), month, day)
}

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = year.div_euclid(400);
    let yoe = year.rem_euclid(400);
    let doy = (153 * ((month + 9) % 12) + 2) / 5 + day - 1;
    era * 146097 + yoe * 365 + yoe / 4 - yoe / 100 + doy - 719468
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calendar_round_trips() {
        for (y, m, d) in [(1970, 1, 1), (2024, 2, 29), (2026, 10, 28), (2027, 1, 3), (2000, 12, 31)] {
            assert_eq!(civil(days_from_civil(y, m, d)), (y, m, d));
        }
        assert_eq!(days_from_civil(1970, 1, 1), 0);
    }

    #[test]
    fn iso_weeks_match_the_calendar() {
        let week = |y, m, d| {
            let day = days_from_civil(y, m, d);
            iso_week(day - (day + 3).rem_euclid(7))
        };
        assert_eq!(week(2026, 10, 28), 44);
        assert_eq!(week(2026, 1, 1), 1);
        assert_eq!(week(2027, 1, 3), 53);
        assert_eq!(week(2021, 1, 3), 53);
        assert_eq!(week(2024, 12, 30), 1);
    }

    #[test]
    fn plan_for_week_44_of_2026() {
        let text = plan(days_from_civil(2026, 10, 28));
        assert!(text.contains("Aktuelle Woche (KW 44)\x1b[0m\n26.10. - 1.11.\n"), "{text}");
        assert!(text.contains("  • 1 Reissner: Bad\n  • 2 Tripolt: Küche + Müll\n  • 3 Kendlbacher: WC\n"), "{text}");
        assert!(text.contains("Nächste Woche (KW 45)\x1b[0m\n2.11. - 8.11.\n"), "{text}");
        assert!(text.contains("  • 1 Reissner: Küche + Müll\n  • 2 Tripolt: WC\n  • 3 Kendlbacher: Bad\n"), "{text}");
    }
}
