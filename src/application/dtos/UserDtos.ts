import { User } from "../../domain/entities/User";

export interface ApplicationActor {
  uid: string;
  userType: "client" | "driver" | "admin" | "seller";
  status: "pending" | "active" | "inactive" | "banned" | "rejected";
  email?: string;
}

export interface CreateUserDto extends User {
  password: string;
}

export interface UpdateUserStatusDto {
  uid: string;
  status: "pending" | "active" | "inactive" | "banned" | "rejected";
}