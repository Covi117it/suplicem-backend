import { Trip } from "../entities/Trip";
import { User } from "../entities/User";

const ACTIVE_TRIP_STATUSES = ["assigned", "accepted", "started", "in_progress"];

export interface DriverLoad {
  driver: User;
  committedTons: number;
  remainingTons: number;
}

const getDriverCapacity = (driver: User): number => {
  const tons = Number(driver?.vehicle?.tons);
  return Number.isFinite(tons) && tons > 0 ? tons : 0;
};

const getCommittedTons = (driverId: string, trips: Trip[]): number => {
  return trips
    .filter((trip) => {
      const tripDriver = trip.assignedDriverId || (trip as any).driverId;
      return (
        tripDriver === driverId &&
        ACTIVE_TRIP_STATUSES.includes(String(trip.status || ""))
      );
    })
    .reduce((sum, trip) => sum + (Number(trip.totalTons) || 0), 0);
};

/**
 * Selecciona el conductor activo con menor capacidad suficiente para la carga.
 * Si ninguno cubre la carga, devuelve el conductor con mayor capacidad restante.
 */
export function selectBestDriver(
  drivers: User[],
  trips: Trip[],
  requiredTons: number
): string | undefined {
  const required = Number(requiredTons) || 0;

  const candidates: DriverLoad[] = drivers
    .filter(
      (driver) =>
        driver.userType === "driver" &&
        driver.status === "active" &&
        Boolean(driver.uid)
    )
    .map((driver) => {
      const capacity = getDriverCapacity(driver);
      const committedTons = getCommittedTons(driver.uid, trips);
      return {
        driver,
        committedTons,
        remainingTons: Math.max(0, capacity - committedTons),
      };
    })
    .filter((candidate) => candidate.remainingTons > 0);

  if (candidates.length === 0) {
    return undefined;
  }

  const fitting = candidates
    .filter((candidate) => candidate.remainingTons >= required)
    .sort((a, b) => a.remainingTons - b.remainingTons);

  if (fitting.length > 0) {
    return fitting[0].driver.uid;
  }

  const maxRemaining = candidates.sort(
    (a, b) => b.remainingTons - a.remainingTons
  )[0];

  return maxRemaining.driver.uid;
}
