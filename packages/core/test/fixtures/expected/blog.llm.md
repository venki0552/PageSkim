<!-- pageskim 0.1 -->
# We cut our home lab's power bill by 40% — measured, not vibes

> A month of watt-meter data, three hardware changes and two scheduler tricks that cut a five-node home lab from 210W idle to 126W.

type: blog
url: https://notes.maren.example.net/2026/homelab-power
lang: en
updated: 2026-05-18
hash: sha256:40d7291feb2093a4

## toc
- intro
- the-baseline
- change-1-kill-the-xeon
- change-2-scheduler-tricks
- change-3-storage
- results
- methodology

## facts
- author: Maren Okafor
- published: 2026-05-18

## chunk intro
summary: By Maren Okafor · 18 May 2026 · 9 min read · #homelab #energy
tags: by-maren-okafor
anchor: #homelab-power

By Maren Okafor · 18 May 2026 · 9 min read · #homelab #energy

Every home-lab post about power savings I've read ends with "it feels snappier and the bill seems lower." This one doesn't. I put a calibrated watt-meter on the rack for a month before touching anything, made one change per week, and kept the meter logging the whole time. Baseline: five nodes drawing a steady 210 W at idle, which at our tariff of €0.31/kWh works out to €571 a year for machines that were mostly waiting for cron jobs.

## chunk the-baseline
summary: The rack held two ex-office Dell towers (a 2019 Precision and an older OptiPlex), a Ryzen NAS build, a Raspberry Pi 4 running DNS, and an aging Xeon…
tags: ryzen-nas, raspberry-pi
anchor: #the-baseline

The rack held two ex-office Dell towers (a 2019 Precision and an older OptiPlex), a Ryzen NAS build, a Raspberry Pi 4 running DNS, and an aging Xeon workstation I kept "for big compiles" and used roughly monthly. Per-device metering told a clear story: the Xeon alone idled at 68 W — a third of the total — and the two Dells together idled at 74 W. The NAS, with six spinning drives, sat at 52 W. The Pi rounded things out at 4 W, the switch at 12 W.

figure: A DIN-rail power meter showing 209.7 watts, mounted beside a small server rack — Week zero: the meter that started the argument with myself.

## chunk change-1-kill-the-xeon
summary: The monthly big-compile job moved to the Ryzen box, which finishes it 20% slower — an extra 11 minutes once a month, in exchange for 68 W around the clock.
anchor: #change-1-kill-the-xeon

The monthly big-compile job moved to the Ryzen box, which finishes it 20% slower — an extra 11 minutes once a month, in exchange for 68 W around the clock. The Xeon sold for €140, which also paid for the meter and the SSDs in change 3. New idle: 142 W. This was the whole game, honestly; everything after was refinement.

## chunk change-2-scheduler-tricks
summary: First trick: the two Dells only exist to run weekend batch simulations, so they now suspend to RAM on weekdays and wake on LAN from a 40-line systemd timer on…
anchor: #change-2-scheduler-tricks

First trick: the two Dells only exist to run weekend batch simulations, so they now suspend to RAM on weekdays and wake on LAN from a 40-line systemd timer on the Pi. Suspend draws 2 W each versus 37 W idling. Second trick: the NAS spins drives down after 20 minutes, but backups used to trickle in all evening and keep resetting the timer — batching every client's backup into one 02:00 window means the drives sleep 21 hours a day instead of 9. Together: −49 W on the weekly average. New average draw: 93 W weekdays, 126 W overall.

## chunk change-3-storage
summary: Only the two most-accessed drives (media metadata and the backup staging volume) moved to used enterprise SSDs; the four bulk archive drives stayed.
tags: full-array-ssd
anchor: #change-3-storage

Only the two most-accessed drives (media metadata and the backup staging volume) moved to used enterprise SSDs; the four bulk archive drives stayed. That kept costs at €118 and shaved a further 9 W of average draw, because the staging volume no longer wakes the whole array for small writes. Full-array SSD would have cost ~€900 to save the remaining ~20 W — a 14-year payback I declined.

## chunk results
summary: Final numbers after four weeks of post-change logging: 126 W average draw, down from 210 W — exactly 40%, or €229/year at our tariff.
anchor: #results

Final numbers after four weeks of post-change logging: 126 W average draw, down from 210 W — exactly 40%, or €229/year at our tariff. Total spend net of selling the Xeon: −€22. The thing I'd skip next time: undervolting the Ryzen. Two evenings of stability testing bought 4 W and one mysterious crash a fortnight later that cost me a Saturday morning. The boring changes — turn things off, batch the work — did 90% of the saving.

## chunk methodology
summary: The meter is a DIN-rail Eastron SDM230 logging to the Pi over Modbus once a minute; I verified it against a plug-in Zhurui PR10 on three devices and the…
tags: din-rail-eastron-sdm230, zhurui-pr10
anchor: #methodology

The meter is a DIN-rail Eastron SDM230 logging to the Pi over Modbus once a minute; I verified it against a plug-in Zhurui PR10 on three devices and the readings agreed within 1.5%. "Idle" means the box is up, services running, no interactive session — not suspend. Weekly averages exclude the two days I was physically rearranging the rack, because unplugged servers make flattering graphs. The raw CSV (43,000 rows) and the notebook that produced every number in this post are linked at the bottom; if you find an arithmetic error I will buy you a coffee and publish a correction.

> The cheapest watt is the one you stop drawing; the second-cheapest is the one you schedule.
