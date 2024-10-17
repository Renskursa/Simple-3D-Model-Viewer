<template>
    <div class="tool-rack">
        <button
            v-for="tool in tools"
            :key="tool"
            :class="{ selected: tool === selectedTool }"
            @click="selectTool(tool)"
        >
            {{ tool.charAt(0).toUpperCase() + tool.slice(1) }} Tool
        </button>
    </div>
</template>

<script>
export default {
    name: 'ToolRack',
    props: {
        selectedTool: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            tools: ['gizmo', 'paint']
        };
    },
    methods: {
        selectTool(tool) {
            if (tool !== this.selectedTool) {
                this.$emit('tool-selected', tool);
            }
        }
    }
}
</script>

<style scoped>
.tool-rack {
    display: flex;
    user-select: none;
    outline: none;
    flex-direction: column;
    position: fixed;
    left: 10px;
    top: 10px;
    gap: 10px;
}

button {
    padding: 10px;
    cursor: pointer;
    border-radius: 10px;
    border: none;
}

button.selected {
    background-color: #007bff;
    color: white;
}
</style>