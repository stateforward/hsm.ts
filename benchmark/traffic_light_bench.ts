import * as hsm from "../src/index.ts";

const WARMUP_MS = Math.max(1, Number.parseInt(process.env.HSM_BENCH_WARMUP_MS ?? "250", 10));
const DURATION_MS = Math.max(1, Number.parseInt(process.env.HSM_BENCH_DURATION_MS ?? "2000", 10));
const VALIDATE = !["", "0", "false", "False"].includes(process.env.HSM_BENCH_VALIDATE ?? "0");
const TARGET_BATCH_MS = 10;

const TimerEvent: hsm.Event = { name: "TimerEvent", kind: hsm.kinds.Event };
const CarArrival: hsm.Event = { name: "CarArrival", kind: hsm.kinds.Event };
const MaintenanceSwitch: hsm.Event = { name: "MaintenanceSwitch", kind: hsm.kinds.Event };
const PedestrianButton: hsm.Event = { name: "PedestrianButton", kind: hsm.kinds.Event };
const Tick: hsm.Event = { name: "Tick", kind: hsm.kinds.Event };

class TrafficLight extends hsm.Instance {
    maintenanceMode = false;
    carsWaiting = 0;
    timer = 0;

    static resetCars(_ctx: hsm.Context, inst: TrafficLight, _event: hsm.Event): void {
        inst.carsWaiting = 0;
    }

    static addCar(_ctx: hsm.Context, inst: TrafficLight, _event: hsm.Event): void {
        inst.carsWaiting += 1;
    }

    static noCarsWaiting(_ctx: hsm.Context, inst: TrafficLight, _event: hsm.Event): boolean {
        return inst.carsWaiting === 0;
    }

    static isMaintenance(_ctx: hsm.Context, inst: TrafficLight, _event: hsm.Event): boolean {
        return inst.maintenanceMode === true;
    }

    static isNotMaintenance(_ctx: hsm.Context, inst: TrafficLight, _event: hsm.Event): boolean {
        return inst.maintenanceMode === false;
    }

    static checkCarsForChoice(_ctx: hsm.Context, inst: TrafficLight, _event: hsm.Event): boolean {
        return inst.carsWaiting > 10;
    }

    static setTimerExtended(_ctx: hsm.Context, inst: TrafficLight, _event: hsm.Event): void {
        inst.timer = 60;
    }

    static setTimerStandard(_ctx: hsm.Context, inst: TrafficLight, _event: hsm.Event): void {
        inst.timer = 40;
    }

    static model = hsm.define(
        "TrafficLight",
        hsm.initial(hsm.target("operational")),

        hsm.state(
            "operational",
            hsm.transition(
                hsm.on(MaintenanceSwitch),
                hsm.guard(TrafficLight.isMaintenance),
                hsm.target("../maintenance"),
            ),
            hsm.initial(hsm.target("red")),

            hsm.state(
                "red",
                hsm.transition(
                    hsm.on(TimerEvent),
                    hsm.guard(TrafficLight.checkCarsForChoice),
                    hsm.effect(TrafficLight.setTimerExtended),
                    hsm.target("../green"),
                ),
                hsm.transition(
                    hsm.on(TimerEvent),
                    hsm.effect(TrafficLight.setTimerStandard),
                    hsm.target("../green"),
                ),
                hsm.transition(
                    hsm.on(CarArrival),
                    hsm.effect(TrafficLight.addCar),
                ),
            ),

            hsm.state(
                "green",
                hsm.transition(
                    hsm.on(TimerEvent),
                    hsm.target("../yellow"),
                ),
                hsm.transition(
                    hsm.on(PedestrianButton),
                    hsm.guard(TrafficLight.noCarsWaiting),
                    hsm.target("../yellow"),
                ),
            ),

            hsm.state(
                "yellow",
                hsm.defer("CarArrival"),
                hsm.transition(
                    hsm.on(TimerEvent),
                    hsm.target("../red"),
                ),
            ),
        ),

        hsm.state(
            "maintenance",
            hsm.entry(TrafficLight.resetCars),
            hsm.transition(
                hsm.on(Tick),
                hsm.effect((_ctx: hsm.Context, inst: TrafficLight) => {
                    inst.timer = inst.timer === 0 ? 1 : 0;
                }),
            ),
            hsm.transition(
                hsm.on(MaintenanceSwitch),
                hsm.guard(TrafficLight.isNotMaintenance),
                hsm.target("../operational"),
            ),
        ),
    );
}

function assertTrafficLight(
    light: TrafficLight,
    state: string,
    carsWaiting: number,
    timer: number,
    step: string,
): void {
    if (light.state() !== state) {
        throw new Error(`${step}: state ${light.state()}, expected ${state}`);
    }
    if (light.carsWaiting !== carsWaiting) {
        throw new Error(`${step}: carsWaiting ${light.carsWaiting}, expected ${carsWaiting}`);
    }
    if (light.timer !== timer) {
        throw new Error(`${step}: timer ${light.timer}, expected ${timer}`);
    }
}

async function dispatchBatch(light: TrafficLight, cycles: number): Promise<void> {
    for (let i = 0; i < cycles; i += 1) {
        await light.dispatch(CarArrival);
        await light.dispatch(TimerEvent);
        await light.dispatch(TimerEvent);
        await light.dispatch(TimerEvent);
    }
}

async function calibrateBatch(light: TrafficLight): Promise<number> {
    let cycles = 1;
    while (true) {
        const start = performance.now();
        await dispatchBatch(light, cycles);
        const elapsedMs = performance.now() - start;
        if (elapsedMs >= TARGET_BATCH_MS || cycles >= (1 << 20)) {
            return cycles;
        }
        cycles *= 2;
    }
}

async function runFor(
    light: TrafficLight,
    durationMs: number,
    batchCycles: number,
): Promise<{ cycles: number; durationMs: number }> {
    const start = performance.now();
    const deadline = start + durationMs;
    let cycles = 0;
    while (performance.now() < deadline) {
        await dispatchBatch(light, batchCycles);
        cycles += batchCycles;
    }
    return {
        cycles,
        durationMs: performance.now() - start,
    };
}

async function validateTrafficLight(): Promise<void> {
    const ctx = new hsm.Context();
    const light = new TrafficLight();
    hsm.start(ctx, light, TrafficLight.model);
    assertTrafficLight(light, "/TrafficLight/operational/red", 0, 0, "initial");

    const completion = light.dispatch(CarArrival);
    if (!completion || typeof completion.then !== "function") {
        throw new Error("dispatch did not return an awaitable completion");
    }
    await completion;
    assertTrafficLight(light, "/TrafficLight/operational/red", 1, 0, "after CarArrival");

    await light.dispatch(TimerEvent);
    assertTrafficLight(light, "/TrafficLight/operational/green", 1, 40, "after first TimerEvent");

    await light.dispatch(TimerEvent);
    assertTrafficLight(light, "/TrafficLight/operational/yellow", 1, 40, "after second TimerEvent");

    await light.dispatch(TimerEvent);
    assertTrafficLight(light, "/TrafficLight/operational/red", 1, 40, "after third TimerEvent");
}

async function runBenchmark(): Promise<void> {
    const ctx = new hsm.Context();

    if (VALIDATE) {
        await validateTrafficLight();
    }

    const warmupLight = new TrafficLight();
    hsm.start(ctx, warmupLight, TrafficLight.model);
    const batchCycles = await calibrateBatch(warmupLight);
    await runFor(warmupLight, WARMUP_MS, batchCycles);

    const lightBench = new TrafficLight();
    hsm.start(ctx, lightBench, TrafficLight.model);
    const { cycles, durationMs } = await runFor(lightBench, DURATION_MS, batchCycles);

    const totalDispatches = cycles * 4;
    const opsPerSec = durationMs > 0 ? Math.trunc(totalDispatches / (durationMs / 1000)) : 0;
    const memoryMb = process.memoryUsage().heapUsed / 1024 / 1024;

    console.log(JSON.stringify({
        language: "TypeScript",
        iterations: totalDispatches,
        duration_ms: Math.round(durationMs),
        memory_mb: Number(memoryMb.toFixed(2)),
        throughput_ops_per_sec: opsPerSec,
    }));
}

runBenchmark().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
