// === Cờ Tỷ Phú (Monopoly) Types ===

// Property colors (8 color groups)
export type PropertyColor =
  | "brown"
  | "lightblue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "blue";

// Types of board spaces
export type SpaceType =
  | "go"
  | "property"
  | "railroad"
  | "utility"
  | "tax"
  | "chance"
  | "chest"
  | "jail"
  | "parking"
  | "gotojail";

// Board space interface
export interface BoardSpace {
  id: number;
  name: string;
  nameVi: string; // Vietnamese name
  type: SpaceType;
  // Property-specific fields
  color?: PropertyColor;
  price?: number;
  rent?: number[]; // [base, 1house, 2house, 3house, 4house, hotel]
  houseCost?: number;
  // Railroad/Utility specific
  baseRent?: number;
  // Tax specific
  taxAmount?: number;
}

// Property ownership
export interface OwnedProperty {
  spaceId: number;
  ownerId: string;
  houses: number; // 0-4 houses, 5 = hotel
  mortgaged: boolean;
}

// Player interface
export interface MonopolyPlayer {
  id: string | null;
  username: string;
  color: string; // Token color
  position: number; // 0-39
  money: number;
  inJail: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  isBot: boolean;
}

// Chance/Community Chest cards
export interface Card {
  id: number;
  text: string;
  textVi: string;
  action: CardAction;
}

export type CardAction =
  | { type: "COLLECT"; amount: number }
  | { type: "PAY"; amount: number }
  | { type: "MOVE"; position: number }
  | { type: "MOVE_RELATIVE"; spaces: number }
  | { type: "GO_TO_JAIL" }
  | { type: "GET_OUT_JAIL" }
  | { type: "PAY_EACH_PLAYER"; amount: number }
  | { type: "COLLECT_FROM_EACH"; amount: number }
  | { type: "REPAIRS"; perHouse: number; perHotel: number };

// Main game state
export interface MonopolyState {
  players: MonopolyPlayer[];
  currentPlayerIndex: number;
  properties: OwnedProperty[];
  diceValues: [number, number] | null;
  doublesCount: number; // Consecutive doubles rolled
  hasRolled: boolean;
  canRollAgain: boolean;
  gamePhase: "waiting" | "playing" | "ended";
  winner: string | null;
  pendingAction:
    | null
    | { type: "BUY_DECISION"; spaceId: number }
    | { type: "PAY_RENT"; amount: number; toPlayerId: string }
    | { type: "PAY_TAX"; amount: number }
    | { type: "CARD"; card: Card };
  lastAction: string | null; // Description of last action for UI
}

// === Actions ===
export interface RollDiceAction {
  type: "ROLL_DICE";
  playerId: string;
}

export interface BuyPropertyAction {
  type: "BUY_PROPERTY";
  playerId: string;
  spaceId: number;
}

export interface DeclinePropertyAction {
  type: "DECLINE_PROPERTY";
  playerId: string;
}

export interface BuildHouseAction {
  type: "BUILD_HOUSE";
  playerId: string;
  spaceId: number;
}

export interface SellHouseAction {
  type: "SELL_HOUSE";
  playerId: string;
  spaceId: number;
}

export interface MortgageAction {
  type: "MORTGAGE";
  playerId: string;
  spaceId: number;
}

export interface UnmortgageAction {
  type: "UNMORTGAGE";
  playerId: string;
  spaceId: number;
}

export interface PayRentAction {
  type: "PAY_RENT";
  playerId: string;
}

export interface PayTaxAction {
  type: "PAY_TAX";
  playerId: string;
}

export interface UseCardAction {
  type: "USE_CARD";
  playerId: string;
}

export interface PayJailFineAction {
  type: "PAY_JAIL_FINE";
  playerId: string;
}

export interface EndTurnAction {
  type: "END_TURN";
  playerId: string;
}

export interface StartGameAction {
  type: "START_GAME";
}

export interface AddBotAction {
  type: "ADD_BOT";
  slotIndex: number;
}

export interface RemoveBotAction {
  type: "REMOVE_BOT";
  slotIndex: number;
}

export interface RequestSyncAction {
  type: "REQUEST_SYNC";
}

export type MonopolyAction =
  | RollDiceAction
  | BuyPropertyAction
  | DeclinePropertyAction
  | BuildHouseAction
  | SellHouseAction
  | MortgageAction
  | UnmortgageAction
  | PayRentAction
  | PayTaxAction
  | UseCardAction
  | PayJailFineAction
  | EndTurnAction
  | StartGameAction
  | AddBotAction
  | RemoveBotAction
  | RequestSyncAction;

// === Constants ===
export const START_MONEY = 15000; // 15,000đ
export const SALARY = 2000; // Passing GO
export const JAIL_FINE = 500;
export const MAX_JAIL_TURNS = 3;
export const MAX_HOUSES = 4;
export const MAX_PLAYERS = 4;

// Player token colors
export const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b"];

// === Board Spaces (40 spaces, clockwise from GO) ===
export const BOARD_SPACES: BoardSpace[] = [
  // Bottom row (right to left when viewing)
  { id: 0, name: "GO", nameVi: "KHỞI HÀNH", type: "go" },
  {
    id: 1,
    name: "Hang Bai",
    nameVi: "Hàng Bài",
    type: "property",
    color: "brown",
    price: 600,
    rent: [20, 100, 300, 900, 1600, 2500],
    houseCost: 500,
  },
  { id: 2, name: "Community Chest", nameVi: "Cộng Đồng", type: "chest" },
  {
    id: 3,
    name: "Hang Dao",
    nameVi: "Hàng Đào",
    type: "property",
    color: "brown",
    price: 600,
    rent: [40, 200, 600, 1800, 3200, 4500],
    houseCost: 500,
  },
  {
    id: 4,
    name: "Income Tax",
    nameVi: "Thuế Thu Nhập",
    type: "tax",
    taxAmount: 2000,
  },
  {
    id: 5,
    name: "Ga Ha Noi",
    nameVi: "Ga Hà Nội",
    type: "railroad",
    price: 2000,
    baseRent: 250,
  },
  {
    id: 6,
    name: "Hang Gai",
    nameVi: "Hàng Gai",
    type: "property",
    color: "lightblue",
    price: 1000,
    rent: [60, 300, 900, 2700, 4000, 5500],
    houseCost: 500,
  },
  { id: 7, name: "Chance", nameVi: "Cơ Hội", type: "chance" },
  {
    id: 8,
    name: "Hang Bong",
    nameVi: "Hàng Bông",
    type: "property",
    color: "lightblue",
    price: 1000,
    rent: [60, 300, 900, 2700, 4000, 5500],
    houseCost: 500,
  },
  {
    id: 9,
    name: "Hang Ma",
    nameVi: "Hàng Mã",
    type: "property",
    color: "lightblue",
    price: 1200,
    rent: [80, 400, 1000, 3000, 4500, 6000],
    houseCost: 500,
  },
  // Left column (bottom to top)
  { id: 10, name: "Jail", nameVi: "Thăm Tù", type: "jail" },
  {
    id: 11,
    name: "Pho Hue",
    nameVi: "Phố Huế",
    type: "property",
    color: "pink",
    price: 1400,
    rent: [100, 500, 1500, 4500, 6250, 7500],
    houseCost: 1000,
  },
  {
    id: 12,
    name: "Electric Company",
    nameVi: "Công Ty Điện",
    type: "utility",
    price: 1500,
    baseRent: 40, // 4x or 10x dice roll
  },
  {
    id: 13,
    name: "Ba Trieu",
    nameVi: "Bà Triệu",
    type: "property",
    color: "pink",
    price: 1400,
    rent: [100, 500, 1500, 4500, 6250, 7500],
    houseCost: 1000,
  },
  {
    id: 14,
    name: "Trang Tien",
    nameVi: "Tràng Tiền",
    type: "property",
    color: "pink",
    price: 1600,
    rent: [120, 600, 1800, 5000, 7000, 9000],
    houseCost: 1000,
  },
  {
    id: 15,
    name: "Ga Sai Gon",
    nameVi: "Ga Sài Gòn",
    type: "railroad",
    price: 2000,
    baseRent: 250,
  },
  {
    id: 16,
    name: "Le Loi",
    nameVi: "Lê Lợi",
    type: "property",
    color: "orange",
    price: 1800,
    rent: [140, 700, 2000, 5500, 7500, 9500],
    houseCost: 1000,
  },
  { id: 17, name: "Community Chest", nameVi: "Cộng Đồng", type: "chest" },
  {
    id: 18,
    name: "Ham Nghi",
    nameVi: "Hàm Nghi",
    type: "property",
    color: "orange",
    price: 1800,
    rent: [140, 700, 2000, 5500, 7500, 9500],
    houseCost: 1000,
  },
  {
    id: 19,
    name: "Nguyen Hue",
    nameVi: "Nguyễn Huệ",
    type: "property",
    color: "orange",
    price: 2000,
    rent: [160, 800, 2200, 6000, 8000, 10000],
    houseCost: 1000,
  },
  // Top row (left to right)
  { id: 20, name: "Free Parking", nameVi: "Đỗ Xe Miễn Phí", type: "parking" },
  {
    id: 21,
    name: "Dong Khoi",
    nameVi: "Đồng Khởi",
    type: "property",
    color: "red",
    price: 2200,
    rent: [180, 900, 2500, 7000, 8750, 10500],
    houseCost: 1500,
  },
  { id: 22, name: "Chance", nameVi: "Cơ Hội", type: "chance" },
  {
    id: 23,
    name: "Le Thanh Ton",
    nameVi: "Lê Thánh Tôn",
    type: "property",
    color: "red",
    price: 2200,
    rent: [180, 900, 2500, 7000, 8750, 10500],
    houseCost: 1500,
  },
  {
    id: 24,
    name: "Hai Ba Trung",
    nameVi: "Hai Bà Trưng",
    type: "property",
    color: "red",
    price: 2400,
    rent: [200, 1000, 3000, 7500, 9250, 11000],
    houseCost: 1500,
  },
  {
    id: 25,
    name: "Ga Da Nang",
    nameVi: "Ga Đà Nẵng",
    type: "railroad",
    price: 2000,
    baseRent: 250,
  },
  {
    id: 26,
    name: "Phan Boi Chau",
    nameVi: "Phan Bội Châu",
    type: "property",
    color: "yellow",
    price: 2600,
    rent: [220, 1100, 3300, 8000, 9750, 11500],
    houseCost: 1500,
  },
  {
    id: 27,
    name: "Phan Chu Trinh",
    nameVi: "Phan Chu Trinh",
    type: "property",
    color: "yellow",
    price: 2600,
    rent: [220, 1100, 3300, 8000, 9750, 11500],
    houseCost: 1500,
  },
  {
    id: 28,
    name: "Water Works",
    nameVi: "Công Ty Nước",
    type: "utility",
    price: 1500,
    baseRent: 40,
  },
  {
    id: 29,
    name: "Ly Thai To",
    nameVi: "Lý Thái Tổ",
    type: "property",
    color: "yellow",
    price: 2800,
    rent: [240, 1200, 3600, 8500, 10250, 12000],
    houseCost: 1500,
  },
  // Right column (top to bottom)
  { id: 30, name: "Go To Jail", nameVi: "Vào Tù", type: "gotojail" },
  {
    id: 31,
    name: "Tran Hung Dao",
    nameVi: "Trần Hưng Đạo",
    type: "property",
    color: "green",
    price: 3000,
    rent: [260, 1300, 3900, 9000, 11000, 12750],
    houseCost: 2000,
  },
  {
    id: 32,
    name: "Dien Bien Phu",
    nameVi: "Điện Biên Phủ",
    type: "property",
    color: "green",
    price: 3000,
    rent: [260, 1300, 3900, 9000, 11000, 12750],
    houseCost: 2000,
  },
  { id: 33, name: "Community Chest", nameVi: "Cộng Đồng", type: "chest" },
  {
    id: 34,
    name: "Le Duan",
    nameVi: "Lê Duẩn",
    type: "property",
    color: "green",
    price: 3200,
    rent: [280, 1500, 4500, 10000, 12000, 14000],
    houseCost: 2000,
  },
  {
    id: 35,
    name: "Ga Hue",
    nameVi: "Ga Huế",
    type: "railroad",
    price: 2000,
    baseRent: 250,
  },
  { id: 36, name: "Chance", nameVi: "Cơ Hội", type: "chance" },
  {
    id: 37,
    name: "Phu My Hung",
    nameVi: "Phú Mỹ Hưng",
    type: "property",
    color: "blue",
    price: 3500,
    rent: [350, 1750, 5000, 11000, 13000, 15000],
    houseCost: 2000,
  },
  {
    id: 38,
    name: "Luxury Tax",
    nameVi: "Thuế Xa Xỉ",
    type: "tax",
    taxAmount: 1000,
  },
  {
    id: 39,
    name: "Thu Thiem",
    nameVi: "Thủ Thiêm",
    type: "property",
    color: "blue",
    price: 4000,
    rent: [500, 2000, 6000, 14000, 17000, 20000],
    houseCost: 2000,
  },
];

// Property color display colors
export const PROPERTY_COLORS: Record<PropertyColor, string> = {
  brown: "#8B4513",
  lightblue: "#87CEEB",
  pink: "#FF69B4",
  orange: "#FFA500",
  red: "#FF0000",
  yellow: "#FFD700",
  green: "#228B22",
  blue: "#0000CD",
};

// Chance cards
export const CHANCE_CARDS: Card[] = [
  {
    id: 1,
    text: "Advance to GO",
    textVi: "Đi đến ô Khởi Hành",
    action: { type: "MOVE", position: 0 },
  },
  {
    id: 2,
    text: "Go to Jail",
    textVi: "Đi vào Tù",
    action: { type: "GO_TO_JAIL" },
  },
  {
    id: 3,
    text: "Bank pays you 500đ",
    textVi: "Ngân hàng trả bạn 500đ",
    action: { type: "COLLECT", amount: 500 },
  },
  {
    id: 4,
    text: "Pay 150đ fine",
    textVi: "Nộp phạt 150đ",
    action: { type: "PAY", amount: 150 },
  },
  {
    id: 5,
    text: "Advance to Đồng Khởi",
    textVi: "Đi đến Đồng Khởi",
    action: { type: "MOVE", position: 21 },
  },
  {
    id: 6,
    text: "Go back 3 spaces",
    textVi: "Lùi 3 ô",
    action: { type: "MOVE_RELATIVE", spaces: -3 },
  },
  {
    id: 7,
    text: "Pay each player 500đ",
    textVi: "Trả mỗi người chơi 500đ",
    action: { type: "PAY_EACH_PLAYER", amount: 500 },
  },
  {
    id: 8,
    text: "Collect 1500đ",
    textVi: "Nhận 1500đ",
    action: { type: "COLLECT", amount: 1500 },
  },
  {
    id: 9,
    text: "Get out of jail free",
    textVi: "Ra tù miễn phí",
    action: { type: "GET_OUT_JAIL" },
  },
  {
    id: 10,
    text: "Repairs: 250đ/house, 1000đ/hotel",
    textVi: "Sửa chữa: 250đ/nhà, 1000đ/khách sạn",
    action: { type: "REPAIRS", perHouse: 250, perHotel: 1000 },
  },
];

// Community Chest cards
export const CHEST_CARDS: Card[] = [
  {
    id: 1,
    text: "Advance to GO",
    textVi: "Đi đến ô Khởi Hành",
    action: { type: "MOVE", position: 0 },
  },
  {
    id: 2,
    text: "Bank error, collect 2000đ",
    textVi: "Lỗi ngân hàng, nhận 2000đ",
    action: { type: "COLLECT", amount: 2000 },
  },
  {
    id: 3,
    text: "Doctor's fee, pay 500đ",
    textVi: "Phí bác sĩ, trả 500đ",
    action: { type: "PAY", amount: 500 },
  },
  {
    id: 4,
    text: "Sale of stock, get 500đ",
    textVi: "Bán cổ phiếu, nhận 500đ",
    action: { type: "COLLECT", amount: 500 },
  },
  {
    id: 5,
    text: "Get out of jail free",
    textVi: "Ra tù miễn phí",
    action: { type: "GET_OUT_JAIL" },
  },
  {
    id: 6,
    text: "Go to Jail",
    textVi: "Đi vào Tù",
    action: { type: "GO_TO_JAIL" },
  },
  {
    id: 7,
    text: "Birthday! Collect 100đ from each",
    textVi: "Sinh nhật! Nhận 100đ từ mỗi người",
    action: { type: "COLLECT_FROM_EACH", amount: 100 },
  },
  {
    id: 8,
    text: "Income tax refund, get 200đ",
    textVi: "Hoàn thuế, nhận 200đ",
    action: { type: "COLLECT", amount: 200 },
  },
  {
    id: 9,
    text: "Pay hospital, 1000đ",
    textVi: "Trả viện phí, 1000đ",
    action: { type: "PAY", amount: 1000 },
  },
  {
    id: 10,
    text: "Inherit 1000đ",
    textVi: "Thừa kế 1000đ",
    action: { type: "COLLECT", amount: 1000 },
  },
];
