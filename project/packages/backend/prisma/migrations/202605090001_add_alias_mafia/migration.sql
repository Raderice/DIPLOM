-- Add new game types for Alias and Mafia
ALTER TYPE "GameType" ADD VALUE IF NOT EXISTS 'ALIAS';
ALTER TYPE "GameType" ADD VALUE IF NOT EXISTS 'MAFIA';
