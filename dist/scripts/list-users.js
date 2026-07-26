"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/scripts/list-users.ts
const prisma_1 = __importDefault(require("../lib/prisma"));
async function main() {
    console.log('🔍 Fetching users from database...');
    try {
        const users = await prisma_1.default.user.findMany({
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                createdAt: true,
            },
        });
        console.log('\n👥 REGISTERED USERS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (users.length === 0) {
            console.log('No users found in the database.');
        }
        else {
            users.forEach((user) => {
                console.log(`👤 Name:   ${user.displayName}`);
                console.log(`📧 Email:  ${user.email}`);
                console.log(`🔑 Role:   ${user.role.toUpperCase()}`);
                console.log(`🆔 ID:     ${user.id}`);
                console.log(`📅 Created:${user.createdAt}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            });
        }
    }
    catch (error) {
        console.error('❌ Failed to fetch users:', error);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
}
main();
//# sourceMappingURL=list-users.js.map