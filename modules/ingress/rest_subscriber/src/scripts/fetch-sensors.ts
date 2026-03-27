#!/usr/bin/env tsx
/**
 * Script to fetch all sensors in a location
 * 
 * Usage:
 *   tsx src/scripts/fetch-sensors.ts <organization_id> <location_id>
 * 
 * Or with environment variables:
 *   EB_ORG_ID=10 EB_LOCATION_ID=123 tsx src/scripts/fetch-sensors.ts
 */

import { logger } from "@spine/shared";
import { getEmpathicBuildingConfig } from "../utils/config.js";
import * as fs from "fs";
import * as path from "path";

async function fetchSensors(organizationId: string, locationId: string) {
    try {
        const config = getEmpathicBuildingConfig();
        
        // Authenticate to get bearer token
        const formData = new URLSearchParams();
        if (config.username && config.password) {
            formData.append("email", config.username);
            formData.append("password", config.password);
        } else {
            throw new Error("Username and password required for authentication");
        }

        const loginResponse = await fetch(`${config.baseUrl}/v1/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
        });

        if (!loginResponse.ok) {
            const errorText = await loginResponse.text();
            throw new Error(`Authentication failed: ${loginResponse.status} - ${errorText}`);
        }

        const loginData = await loginResponse.json();
        const bearerToken = loginData.access_token;

        // Fetch sensors
        const sensorsUrl = `${config.baseUrl}/v1/organizations/${organizationId}/locations/${locationId}/sensors`;
        logger.info(`Fetching sensors from: ${sensorsUrl}`);

        const response = await fetch(sensorsUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${bearerToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch sensors: ${response.status} - ${errorText}`);
        }

        const sensors = await response.json();
        const sensorsArray = Array.isArray(sensors) ? sensors : (sensors.items || sensors.data || []);

        logger.info(`\n=== Sensors in Location ${locationId} (Organization ${organizationId}) ===`);
        logger.info(`Total sensors: ${sensorsArray.length}\n`);

        if (sensorsArray.length > 0) {
            sensorsArray.forEach((sensor: any, index: number) => {
                const id = sensor.id || sensor.sensor_id || sensor.sensorId || "unknown";
                const name = sensor.name || sensor.sensor_name || "unnamed";
                const type = sensor.type || sensor.sensor_type || "unknown";
                logger.info(`${index + 1}. ID: ${id}, Name: ${name}, Type: ${type}`);
            });
        } else {
            logger.warn("No sensors found in this location");
        }

        // Group sensors by type and save to separate JSON files
        const outputDir = path.join(process.cwd(), "data", "sensors");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fetchedAt = new Date().toISOString();

        // Group sensors by type
        const sensorsByType = new Map<string, any[]>();
        
        sensorsArray.forEach((sensor: any) => {
            const type = sensor.type || sensor.sensor_type || "unknown";
            if (!sensorsByType.has(type)) {
                sensorsByType.set(type, []);
            }
            sensorsByType.get(type)!.push(sensor);
        });

        logger.info("\n=== Saving sensors by type ===");
        
        // Save each sensor type to a separate file
        const savedFiles: string[] = [];
        sensorsByType.forEach((sensorsOfType, sensorType) => {
            const safeTypeName = sensorType.replace(/[^a-zA-Z0-9-_]/g, "_");
            const filename = `sensors-${safeTypeName}-org${organizationId}-loc${locationId}-${timestamp}.json`;
            const filePath = path.join(outputDir, filename);

            const jsonData = {
                organizationId,
                locationId,
                fetchedAt,
                sensorType,
                totalSensors: sensorsOfType.length,
                sensors: sensorsOfType,
            };

            fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), "utf-8");
            savedFiles.push(filePath);
            logger.info(`  ✓ ${sensorType}: ${sensorsOfType.length} sensor(s) -> ${filename}`);
        });

        logger.info(`\n=== Saved ${savedFiles.length} JSON file(s) ===`);
        logger.info(`Directory: ${outputDir}`);

        return sensorsArray;
    } catch (error) {
        logger.error("Error fetching sensors:", error);
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    // Get organization_id and location_id from args or env
    const organizationId = args[0] || process.env.EB_ORG_ID;
    const locationId = args[1] || process.env.EB_LOCATION_ID;

    if (!organizationId || !locationId) {
        logger.error("Usage: tsx src/scripts/fetch-sensors.ts <organization_id> <location_id>");
        logger.error("Or set environment variables: EB_ORG_ID and EB_LOCATION_ID");
        process.exit(1);
    }

    try {
        await fetchSensors(organizationId, locationId);
    } catch (error) {
        logger.error("Fatal error:", error);
        process.exit(1);
    }
}

main().catch((error) => {
    logger.error("Fatal error:", error);
    process.exit(1);
});

