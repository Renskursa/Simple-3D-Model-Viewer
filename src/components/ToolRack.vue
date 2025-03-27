<template>
    <div class="tool-rack" :class="{ collapsed: isCollapsed }">
        <div class="panel-header" @click="toggleCollapsed">
            <h3 class="tool-rack-title">Tools</h3>
            <button class="collapse-button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M15,19L8,12L15,5V19Z" />
                </svg>
            </button>
        </div>

        <div class="panel-content">
            <div class="tool-items-container">
                <div class="tool-item" v-for="tool in tools" :key="tool.name">
                    <button
                        :class="{ selected: tool.name === selectedTool }"
                        @click="selectTool(tool.name)"
                    >
                        <span class="tool-icon" v-html="getToolIcon(tool.name)"></span>
                        {{ tool.displayName }}
                    </button>
                    <button
                        v-if="tool.name === selectedTool && tool.name === 'measure'"
                        class="sub-button"
                        @click="toggleSnapping"
                    >
                        {{ enableSnapping ? 'Disable Snapping' : 'Enable Snapping' }}
                    </button>
                </div>
            </div>

            <!-- Snapping toggle for measure tool -->
            <div class="tool-options" v-if="selectedTool === 'measure'">
                <div class="snapping-toggle">
                    <label>
                        <input type="checkbox" :checked="enableSnapping" @change="toggleSnapping">
                        Snap to Vertices
                    </label>
                </div>
            </div>

            <!-- Tool settings for paint tools -->
            <div class="tool-options" v-if="selectedTool === 'brush' || selectedTool === 'fill'">
                <div class="color-picker">
                    <label for="toolColor">Color</label>
                    <div class="color-input-container">
                        <input type="color" id="toolColor" :value="localPaintColor" @input="updatePaintColor">
                        <div class="color-value">{{ localPaintColor }}</div>
                    </div>
                </div>
                <div class="tool-info">
                    <div v-if="selectedTool === 'brush'" class="tool-description">
                        <strong>Brush:</strong> Paints a small circular area. Drag to paint continuously.
                    </div>
                    <div v-if="selectedTool === 'fill'" class="tool-description">
                        <strong>Fill:</strong> Flood-fills connected triangles like a paint bucket.
                    </div>
                </div>
            </div>
        </div>

        <!-- Expand button that's only visible when collapsed -->
        <button class="expand-button" v-if="isCollapsed" @click="toggleCollapsed">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M9,5L16,12L9,19V5Z" />
            </svg>
        </button>
    </div>
</template>

<script>
export default {
    name: 'ToolRack',
    props: {
        selectedTool: {
            type: String,
            default: 'gizmo'
        },
        enableSnapping: {
            type: Boolean,
            default: true
        },
        paintColor: {
            type: String,
            default: '#ff0000'
        }
    },
    emits: ['tool-selected', 'toggle-snapping', 'update-paint-color', 'tool-changed'],
    data() {
        return {
            isCollapsed: false,
            tools: [
                { name: 'gizmo', displayName: 'Transform' },
                { name: 'brush', displayName: 'Brush' },
                { name: 'fill', displayName: 'Fill' },
                { name: 'measure', displayName: 'Measure' }
            ],
            localPaintColor: this.paintColor
        };
    },
    watch: {
        paintColor(newValue) {
            this.localPaintColor = newValue;
        }
    },
    methods: {
        toggleCollapsed() {
            this.isCollapsed = !this.isCollapsed;
        },
        selectTool(tool) {
            if (tool !== this.selectedTool) {
                this.$emit('tool-selected', tool);
            }
        },
        toggleSnapping() {
            this.$emit('toggle-snapping', !this.enableSnapping);
        },
        updatePaintColor(event) {
            this.localPaintColor = event.target.value;
            this.$emit('update-paint-color', event.target.value);
        },
        getToolIcon(toolName) {
            switch(toolName) {
                case 'gizmo':
                    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10,2H14V7H10V2M4.93,3.93L7.76,6.76L4.59,9.93L1.76,7.07L4.93,3.93M19.07,3.93L22.24,7.07L19.41,9.93L16.24,6.76L19.07,3.93M2,10H7V14H2V10M17,10H22V14H17V10M10,17H14V22H10V17M4.93,19.07L1.76,16.24L4.59,13.07L7.76,16.24L4.93,19.07M19.07,19.07L16.24,16.24L19.41,13.07L22.24,16.24L19.07,19.07Z" /></svg>';
                case 'brush':
                    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M10,10A2,2 0 0,1 12,8A2,2 0 0,1 14,10A2,2 0 0,1 12,12A2,2 0 0,1 10,10M8,14H16A4,4 0 0,1 12,18A4,4 0 0,1 8,14Z" /></svg>';
                case 'fill':
                    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19,11.5C19,11.5 17,13.67 17,15A2,2 0 0,0 19,17A2,2 0 0,0 21,15C21,13.67 19,11.5 19,11.5M5.21,10L10,5.21L14.79,10M16.56,8.94L7.62,0L6.21,1.41L8.59,3.79L3.44,8.94C2.85,9.5 2.85,10.47 3.44,11.06L8.94,16.56C9.23,16.85 9.62,17 10,17C10.38,17 10.77,16.85 11.06,16.56L16.56,11.06C17.15,10.47 17.15,9.5 16.56,8.94Z" /></svg>';
                case 'measure':
                    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M1.39,18.36L3.16,16.6L4.58,18L5.64,16.95L4.22,15.54L5.64,14.12L8.11,16.6L9.17,15.54L6.7,13.06L8.11,11.65L9.53,13.06L10.59,12L9.17,10.59L10.59,9.17L13.06,11.65L14.12,10.59L11.65,8.11L13.06,6.7L14.47,8.11L15.54,7.05L14.12,5.64L15.54,4.22L18,6.7L19.07,5.64L16.6,3.16L18.36,1.39L22.61,5.64L5.64,22.61L1.39,18.36Z" /></svg>';
                default:
                    return '';
            }
        },
        handleKeyDown(event) {
            if (event.key === '1' || event.key === 'q') {
                this.$emit('tool-changed', 'gizmo');
            } else if (event.key === '2' || event.key === 'w') {
                this.$emit('tool-changed', 'brush');
            } else if (event.key === '3' || event.key === 'r') {
                this.$emit('tool-changed', 'fill');
            } else if (event.key === '4' || event.key === 'e') {
                this.$emit('tool-changed', 'measure');
            }
        }
    },
    mounted() {
        window.addEventListener('keydown', this.handleKeyDown);
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.handleKeyDown);
    }
}
</script>

<style scoped>
.tool-rack {
    background-color: rgba(26, 26, 46, 0.8);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 100px;
    left: 0;
    z-index: 100;
    backdrop-filter: blur(8px);
    user-select: none;
    transition: transform 0.3s ease;
    width: 220px;
    overflow: visible;
}

.tool-rack.collapsed {
    transform: translateX(-220px);
}

.panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    cursor: pointer;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.collapse-button {
    background: none;
    border: none;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.collapse-button:hover {
    background-color: rgba(255, 255, 255, 0.15);
}

.expand-button {
    position: absolute;
    right: -40px;
    top: 10px;
    background-color: rgba(26, 26, 46, 0.8);
    border: none;
    color: white;
    width: 40px;
    height: 40px;
    border-top-right-radius: 6px;
    border-bottom-right-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 4px 0 12px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(8px);
    transition: background-color 0.2s, transform 0.2s;
}

.expand-button:hover {
    background-color: rgba(38, 38, 66, 0.95);
    transform: translateX(4px);
}

.panel-content {
    padding: 15px;
    overflow-y: auto;
    max-height: calc(100vh - 100px);
}

.tool-rack-title {
    color: white;
    font-size: 16px;
    font-weight: 500;
    margin: 0;
    text-align: left;
    opacity: 0.8;
}

.tool-items-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.tool-icon {
    display: inline-flex;
    align-items: center;
    margin-right: 8px;
    vertical-align: middle;
}

.tool-item button {
    background-color: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 8px 12px;
    width: 100%;
    transition: background-color 0.2s;
}

.tool-item button:hover {
    background-color: rgba(255, 255, 255, 0.2);
}

.tool-item button.selected {
    background-color: rgba(233, 69, 96, 0.6);
}

.sub-button {
    margin-top: 5px;
    font-size: 12px;
    padding: 4px 8px !important;
}

.tool-options {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
}

.snapping-toggle {
    display: flex;
    align-items: center;
    color: white;
    font-size: 13px;
}

.snapping-toggle input {
    margin-right: 6px;
}

.color-picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.color-picker label {
    color: white;
    font-size: 13px;
}

.color-input-container {
    display: flex;
    align-items: center;
    gap: 8px;
}

.color-input-container input {
    width: 40px;
    height: 24px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
}

.color-value {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
}

.tool-info {
    margin-top: 8px;
}

.tool-description {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.3;
    border-left: 2px solid rgba(233, 69, 96, 0.5);
    padding-left: 8px;
}

/* Mobile styles */
@media (max-width: 768px) {
    .tool-rack {
        top: 10px;
        width: 260px;
    }

    .tool-rack.collapsed {
        transform: translateX(-260px);
    }

    .tool-items-container {
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-between;
    }

    .tool-item {
        width: calc(50% - 5px);
    }

    .tool-options {
        max-width: 100%;
    }
}
</style>