import { IRouteService, RouteDirections, RoutePoint } from "../../../domain/services/IRouteService";

export class GetTripDirectionsUseCase {
  constructor(private routeService: IRouteService) {}

  async execute(origin: RoutePoint, destination: RoutePoint): Promise<RouteDirections> {
    return this.routeService.getDirections(origin, destination);
  }
}
