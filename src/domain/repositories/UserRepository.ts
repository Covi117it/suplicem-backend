import { User } from "../entities/User";

export interface UserFilters {
  status?: string;
  userType?: string;
  aiRiskFlag?: boolean;
}

export interface UserRepository {
  create(user: User): Promise<void>;
  update(uid: string, data: Partial<User>): Promise<void>;
  getById(uid: string): Promise<User | null>;
  getAll(filters?: UserFilters): Promise<User[]>;
}