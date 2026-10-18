module Reports
  class PromptVnEnV1 < PromptV1
    def self.system
      PromptV1.system.sub("report schema v1", "report schema vn_en_v1")
    end
  end
end
