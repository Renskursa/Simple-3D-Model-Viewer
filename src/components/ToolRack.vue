<template>
    <div class="tool-rack">
        <button
            v-for="tool in tools"
            :key="tool.name"
            :class="{ selected: tool.name === selectedTool }"
            @click="selectTool(tool.name)"
        >
            {{ tool.displayName }}
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
            tools: [
                { name: 'gizmo', displayName: 'Gizmo Tool' },
                { name: 'paint', displayName: 'Paint Tool' },
                { name: 'measure', displayName: 'Measure Tool' }
            ]
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