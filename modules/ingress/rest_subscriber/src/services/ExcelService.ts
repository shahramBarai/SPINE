import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";
import { logger } from "@spine/shared";

interface EventData {
    eventType: string;
    channel: string;
    data: unknown;
    timestamp: string | number;
    source: string;
}

export class ExcelService {
    private readonly outputDir: string;
    private readonly fileName: string;
    private readonly filePath: string;

    constructor(outputDir?: string, fileName?: string) {
        // Default to ./data/excel if not specified
        this.outputDir = outputDir || path.join(process.cwd(), "data", "excel");
        this.fileName = fileName || `empathic-building-events-${this.getDateString()}.xlsx`;
        this.filePath = path.join(this.outputDir, this.fileName);

        // Ensure output directory exists
        this.ensureDirectoryExists();
    }

    private ensureDirectoryExists(): void {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
            logger.debug(`Created Excel output directory: ${this.outputDir}`);
        }
    }

    private getDateString(): string {
        const now = new Date();
        return now.toISOString().split("T")[0]; // YYYY-MM-DD format
    }

    /**
     * Save event data to Excel file
     * Creates a new file if it doesn't exist, or appends to existing file
     */
    async saveEvent(eventData: EventData): Promise<void> {
        try {
            const workbook = new ExcelJS.Workbook();
            let worksheet: ExcelJS.Worksheet;

            // Check if file exists
            if (fs.existsSync(this.filePath)) {
                await workbook.xlsx.readFile(this.filePath);
                worksheet = workbook.getWorksheet("Events") || workbook.addWorksheet("Events");
            } else {
                worksheet = workbook.addWorksheet("Events");
                // Add headers if it's a new file
                worksheet.addRow([
                    "Event Type",
                    "Channel",
                    "Data",
                    "Timestamp",
                    "Source",
                ]);

                // Style the header row
                const headerRow = worksheet.getRow(1);
                headerRow.font = { bold: true };
                headerRow.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFE0E0E0" },
                };
            }

            // Add event data row
            worksheet.addRow([
                eventData.eventType,
                eventData.channel,
                typeof eventData.data === "object"
                    ? JSON.stringify(eventData.data)
                    : String(eventData.data),
                typeof eventData.timestamp === "string"
                    ? eventData.timestamp
                    : new Date(eventData.timestamp).toISOString(),
                eventData.source,
            ]);

            // Auto-size columns
            worksheet.columns.forEach((column) => {
                if (column.header) {
                    column.width = Math.max(
                        column.width || 10,
                        column.header.toString().length + 2,
                    );
                }
            });

            // Save the workbook
            await workbook.xlsx.writeFile(this.filePath);

            logger.debug(
                `Saved event ${eventData.eventType} to Excel file: ${this.filePath}`,
            );
        } catch (error) {
            logger.error(
                `Failed to save event to Excel file: ${this.filePath}`,
                error,
            );
            throw error;
        }
    }

    /**
     * Get the current file path
     */
    getFilePath(): string {
        return this.filePath;
    }
}

