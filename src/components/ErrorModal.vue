<template>
  <div class="modal" @click="close">
    <div class="modal-content" @click.stop>
      <div class="error-modal">
        <button class="close" @click="close">&times;</button>
        <div class="error-content">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#e94560" class="error-icon">
            <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
          </svg>
          <div>
            <h3 class="error-title">Error</h3>
            <p class="error-message">{{ errorMessage }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ErrorModal',
  props: {
    errorMessage: {
      type: String,
      required: true
    }
  },
  methods: {
    close() {
      this.$emit('close');
    }
  }
}
</script>

<style scoped>
.error-modal {
  position: relative;
  padding: 10px;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.error-title {
  margin: 0 0 10px 0;
  color: #e94560;
  font-size: 18px;
  font-weight: 600;
}

.error-message {
  margin: 0;
  color: #fff;
  line-height: 1.5;
}

.error-icon {
  flex-shrink: 0;
}
</style>